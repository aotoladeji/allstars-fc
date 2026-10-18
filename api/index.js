import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import CA from '../lib/ca.js'

const E = process.env

// ---- Database (Aiven needs SSL, which is what the CA certificate is for) ----
let pool
const db = () => (pool ??= mysql.createPool({ host: E.DB_HOST, port: +E.DB_PORT, user: E.DB_USER, password: E.DB_PASS, database: E.DB_NAME,
  ssl: { ca: CA }, connectionLimit: 1, dateStrings: true, connectTimeout: 8000, enableKeepAlive: true }))
const RETRY = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNREFUSED', 'PROTOCOL_SEQUENCE_TIMEOUT']
const sleep = ms => new Promise(r => setTimeout(r, ms))
const reset = () => { const old = pool; pool = undefined; try { old?.end().catch(() => {}) } catch {} }
const q = async (sql, p = []) => { // a dropped/stalled connection is retried on a fresh one
  for (let attempt = 0; ; attempt++) {
    try { return (await db().query(sql, p))[0] }
    catch (e) {
      if (attempt >= 2 || !RETRY.includes(e.code)) throw e
      reset(); await sleep(250 * (attempt + 1))
    }
  }
}
const one = async (sql, p) => (await q(sql, p))[0] || null
const nul = x => (x === '' || x === undefined ? null : x)
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const mdob = s => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1] || ''}` : null)

// ---- Cloudinary (the browser uploads files itself; the server only signs and deletes) ----
const sign = p => crypto.createHash('sha1').update(Object.keys(p).sort().map(k => `${k}=${p[k]}`).join('&') + E.CLOUDINARY_API_SECRET).digest('hex')
const okUrl = u => typeof u === 'string' && u.startsWith(`https://res.cloudinary.com/${E.CLOUDINARY_CLOUD_NAME}/`)
async function cldDelete(url) {
  const m = url && url.match(/\/(image|video)\/upload\/(?:v\d+\/)?(.+)\.[A-Za-z0-9]+$/); if (!m) return
  const p = { public_id: m[2], timestamp: Math.floor(Date.now() / 1000) }
  try {
    await fetch(`https://api.cloudinary.com/v1_1/${E.CLOUDINARY_CLOUD_NAME}/${m[1]}/destroy`,
      { method: 'POST', body: new URLSearchParams({ ...p, api_key: E.CLOUDINARY_API_KEY, signature: sign(p) }) })
  } catch {}
}

// ---- Logins: a signed cookie holds { admin, player } ----
const getSess = req => { const m = (req.headers.cookie || '').match(/(?:^|; )sess=([^;]+)/); try { return m ? jwt.verify(m[1], E.JWT_SECRET) : {} } catch { return {} } }
const setSess = (res, s) => {
  const { iat, exp, ...x } = s
  res.setHeader('Set-Cookie', `sess=${jwt.sign(x, E.JWT_SECRET, { expiresIn: '30d' })}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`)
}

const PL = 'id,name,position,shirt_no,bio,photo,nationality,dob,height,weight,foot,alt_position,state_origin,state_residence,current_club,career,phone,contact_email,photo2,photo3,certified_on'
const LISTS = {
  news: 'SELECT * FROM news ORDER BY created_at DESC',
  hero_images: 'SELECT * FROM hero_images ORDER BY sort_order,id',
  gallery: 'SELECT * FROM gallery ORDER BY id DESC',
  matches: 'SELECT * FROM matches ORDER BY match_date DESC',
  players: `SELECT ${PL} FROM players ORDER BY shirt_no,name`,
  goals: 'SELECT g.id,g.qty,p.name,m.opponent FROM goals g JOIN players p ON p.id=g.player_id LEFT JOIN matches m ON m.id=g.match_id ORDER BY g.id DESC',
  potm: 'SELECT o.id,o.player_id,o.month,o.note,p.name,p.photo,p.position FROM potm o JOIN players p ON p.id=o.player_id ORDER BY o.month DESC',
}
const SCORERS = 'SELECT p.id,p.name,p.photo,SUM(g.qty) goals FROM goals g JOIN players p ON p.id=g.player_id GROUP BY p.id ORDER BY goals DESC LIMIT 10'
const PCOLS = ['name', 'position', 'shirt_no', 'bio', 'nationality', 'dob', 'height', 'weight', 'foot', 'alt_position', 'state_origin', 'state_residence', 'current_club', 'career', 'phone', 'contact_email']
const CFG = {
  news: { cols: ['title', 'body'] },
  hero_images: { cols: ['caption', 'sort_order'], file: 'image' },
  gallery: { cols: ['caption', 'category'], file: 'file', typed: 1 },
  matches: { cols: ['opponent', 'match_date', 'venue', 'home_score', 'away_score', 'played'], file: 'opponent_logo', optional: 1 },
  goals: { cols: ['player_id', 'match_id', 'qty'] },
  potm: { cols: ['month', 'player_id', 'note'], dup: ' ON DUPLICATE KEY UPDATE player_id=VALUES(player_id),note=VALUES(note)' },
  players: { cols: [] },
}
const FILECOLS = { hero_images: 'image', gallery: 'file', players: 'photo,photo2,photo3', matches: 'opponent_logo' }

// Input/data mistakes get a clear message instead of a scary server error; real faults still log
const INPUT = {
  ER_DATA_TOO_LONG: 'One of the values is too long.',
  ER_BAD_NULL_ERROR: 'Please fill in all required fields.',
  ER_NO_DEFAULT_FOR_FIELD: 'Please fill in all required fields.',
  ER_NO_REFERENCED_ROW_2: 'The linked player or match no longer exists.',
  ER_ROW_IS_REFERENCED_2: 'That item is still in use and cannot be deleted.',
  ER_DUP_ENTRY: 'That entry already exists.',
  ER_WARN_DATA_OUT_OF_RANGE: 'One of the numbers is too large.',
  ER_TRUNCATED_WRONG_VALUE: 'One of the values has the wrong format.',
}
export default async function handler(req, res) {
  const out = (d, c = 200) => res.status(c).json(d)
  try { return await route(req, res, out) }
  catch (e) {
    console.error(`${req.method} ${req.url} ::`, e.code || '', e.sqlMessage || e.message)
    if (INPUT[e.code]) return out({ error: INPUT[e.code] }, 400)
    return out({ error: 'Server error. Please try again.' }, 500)
  }
}

async function route(req, res, out) {
  const { r = '', t = '' } = req.query; const m = req.method; const S = getSess(req)
  const b = req.body && typeof req.body === 'object' ? req.body : {}

  switch (r) {
    case 'home': {
      const [hero, news, potm, scorers, next, hm] = await Promise.all([
        q(LISTS.hero_images), q('SELECT * FROM news ORDER BY created_at DESC LIMIT 3'), q(LISTS.potm + ' LIMIT 1'), q(SCORERS),
        q('SELECT * FROM matches WHERE played=0 AND match_date>=CURDATE() ORDER BY match_date LIMIT 1'), q("SELECT v FROM settings WHERE k='hero_mode'")])
      return out({ hero, news, potm: potm[0] || null, scorers, next: next[0] || null, hero_mode: hm[0]?.v || 'scroll' })
    }
    case 'list': {
      if (!LISTS[t]) return out({ error: 'Unknown list' }, 404)
      const rows = await q(LISTS[t])
      if (t === 'matches') {
        const g = await q('SELECT g.match_id,p.id pid,p.name,SUM(g.qty) qty FROM goals g JOIN players p ON p.id=g.player_id WHERE g.match_id IS NOT NULL GROUP BY g.match_id,p.id ORDER BY qty DESC')
        rows.forEach(x => { x.scorers = g.filter(y => y.match_id == x.id) })
      }
      if (t === 'players') rows.forEach(x => { x.dob = mdob(x.dob) })
      return out(rows)
    }
    case 'player': {
      const p = await one(`SELECT ${PL},created_at FROM players WHERE id=?`, [req.query.id || 0])
      if (!p) return out({ error: 'Player not found' }, 404)
      p.dob = mdob(p.dob)
      p.goals = +(await one('SELECT COALESCE(SUM(qty),0) n FROM goals WHERE player_id=?', [p.id])).n
      p.awards = (await q('SELECT month FROM potm WHERE player_id=? ORDER BY month DESC', [p.id])).map(x => x.month)
      return out(p)
    }
    case 'register': {
      if (m !== 'POST') return out({ error: 'POST only' }, 405)
      const name = (b.name || '').trim(), email = (b.email || '').trim().toLowerCase(), pw = b.password || ''
      if (!name || !/^\S+@\S+\.\S+$/.test(email) || pw.length < 6) return out({ error: 'Enter a name, a valid email and a password of at least 6 characters.' }, 400)
      if (await one('SELECT 1 x FROM players WHERE email=?', [email])) return out({ error: 'That email is already registered.' }, 409)
      const rs = await q('INSERT INTO players(name,email,password,position,shirt_no,bio,introduced_by) VALUES(?,?,?,?,?,?,?)',
        [name, email, await bcrypt.hash(pw, 10), nul(b.position), nul(b.shirt_no) === null ? null : +b.shirt_no, nul(b.bio), (b.introduced_by || '').trim() || null])
      setSess(res, { ...S, player: rs.insertId }); return out({ id: rs.insertId }, 201)
    }
    case 'login': { // admin login
      const a = await one('SELECT * FROM admins WHERE LOWER(username)=?', [(b.username || '').trim().toLowerCase()])
      if (!a || !(await bcrypt.compare(b.password || '', a.password))) return out({ error: 'Wrong username or password.' }, 401)
      setSess(res, { ...S, admin: a.id }); return out({ ok: true })
    }
    case 'logout': { const { admin, ...x } = S; setSess(res, x); return out({ ok: true }) }
    case 'me': return out({ admin: !!S.admin })
    case 'player_login': {
      const p = await one('SELECT id,password FROM players WHERE email=?', [(b.email || '').trim().toLowerCase()])
      if (!p || !(await bcrypt.compare(b.password || '', p.password))) return out({ error: 'Wrong email or password.' }, 401)
      setSess(res, { ...S, player: p.id }); return out({ ok: true })
    }
    case 'player_logout': { const { player, ...x } = S; setSess(res, x); return out({ ok: true }) }
    case 'player_me':
      return out({ player: S.player ? await one(`SELECT ${PL},email FROM players WHERE id=?`, [S.player]) : null })
    case 'player_update': {
      if (!S.player) return out({ error: 'Please log in.' }, 401)
      if (m !== 'POST') return out({ error: 'POST only' }, 405)
      const id = S.player, set = [], v = []
      for (const c of PCOLS) {
        if (b[c] === undefined) continue
        const x = String(b[c]).trim()
        if (c === 'name' && !x) return out({ error: 'Name is required.' }, 400)
        set.push(`${c}=?`); v.push(x === '' ? null : c === 'shirt_no' ? +x : x)
      }
      for (const c of ['photo', 'photo2', 'photo3']) {
        if (!b[c]) continue
        if (!okUrl(b[c])) return out({ error: 'Bad photo link.' }, 400)
        await cldDelete((await one(`SELECT ${c} v FROM players WHERE id=?`, [id]))?.v); set.push(`${c}=?`); v.push(b[c])
      }
      if (b.new_password) {
        if (b.new_password.length < 6) return out({ error: 'New password must be at least 6 characters.' }, 400)
        const h = (await one('SELECT password FROM players WHERE id=?', [id])).password
        if (!(await bcrypt.compare(b.current_password || '', h))) return out({ error: 'Your current password is wrong.' }, 400)
        set.push('password=?'); v.push(await bcrypt.hash(b.new_password, 10))
      }
      if (set.length) await q(`UPDATE players SET ${set.join(',')} WHERE id=?`, [...v, id])
      return out({ ok: true })
    }
    case 'hero_mode':
      if (m === 'POST') {
        if (!S.admin) return out({ error: 'Please log in.' }, 401)
        await q("REPLACE INTO settings(k,v) VALUES('hero_mode',?)", [b.mode === 'static' ? 'static' : 'scroll'])
      }
      return out({ mode: (await one("SELECT v FROM settings WHERE k='hero_mode'"))?.v || 'scroll' })
    case 'admin_players':
      if (!S.admin) return out({ error: 'Please log in.' }, 401)
      return out(await q('SELECT id,name,email,position,introduced_by,certified_on,created_at FROM players ORDER BY created_at DESC'))
    case 'sign': { // permission slip for a direct browser -> Cloudinary upload
      const resource = req.query.resource === 'video' ? 'video' : 'image'
      if (!(S.admin || (S.player && resource === 'image'))) return out({ error: 'Please log in.' }, 401)
      const p = { allowed_formats: resource === 'video' ? 'mp4,webm' : 'jpg,jpeg,png,webp,gif', folder: 'allstars', timestamp: Math.floor(Date.now() / 1000) }
      return out({ ...p, signature: sign(p), api_key: E.CLOUDINARY_API_KEY, cloud_name: E.CLOUDINARY_CLOUD_NAME })
    }
    case 'admin': {
      if (!S.admin) return out({ error: 'Please log in.' }, 401)
      const c = CFG[t]; if (!c) return out({ error: 'Unknown section' }, 404)
      if (m === 'DELETE') {
        const id = req.query.id || 0
        if (FILECOLS[t]) Object.values((await one(`SELECT ${FILECOLS[t]} FROM ${t} WHERE id=?`, [id])) || {}).forEach(cldDelete)
        await q(`DELETE FROM ${t} WHERE id=?`, [id]); return out({ ok: true })
      }
      if (m !== 'POST' || !(c.cols.length || t === 'players')) return out({ error: 'Not allowed' }, 405)
      if (t === 'players') { await q(`UPDATE players SET certified_on=${b.certify ? 'CURDATE()' : 'NULL'} WHERE id=?`, [+b.id || 0]); return out({ ok: true }) }
      if (t === 'matches' && b.id) { await q('UPDATE matches SET home_score=?,away_score=?,played=1 WHERE id=?', [+b.home_score || 0, +b.away_score || 0, +b.id]); return out({ ok: true }) }
      if (t === 'hero_images') {
        const urls = [].concat(b.file || []).filter(okUrl)
        if (!urls.length) return out({ error: 'Choose at least one image.' }, 400)
        for (const u of urls) await q('INSERT INTO hero_images(image,caption,sort_order) VALUES(?,?,?)', [u, nul(b.caption), +b.sort_order || 0])
        return out({ ok: true, added: urls.length }, 201)
      }
      const f = [], v = []
      for (const col of c.cols) if (b[col] !== undefined) { f.push(col); v.push(nul(b[col])) }
      if (c.file) {
        if (b.file) {
          if (!okUrl(b.file)) return out({ error: 'Bad file link.' }, 400)
          f.push(c.file); v.push(b.file)
          if (c.typed) { f.push('type'); v.push(b.file.includes('/video/upload/') ? 'video' : 'image') }
        } else if (!c.optional) return out({ error: 'Please choose a file.' }, 400)
      }
      await q(`INSERT INTO ${t}(${f.join(',')}) VALUES(${f.map(() => '?').join(',')})${c.dup || ''}`, v)
      return out({ ok: true }, 201)
    }
    default: return out({ error: 'Unknown route' }, 404)
  }
}