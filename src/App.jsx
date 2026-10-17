import { useEffect, useRef, useState } from 'react'
import { Routes, Route, NavLink, Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { api, img, useApi } from './api'
import { INTRO, GLANCE, JOIN, FINES, RULES } from './clubInfo'

const LOGO = import.meta.env.BASE_URL + 'logo.png'
const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const Empty = ({ children }) => <p className="empty">{children}</p>
const Face = ({ p, cls = '' }) => p.photo ? <img className={cls} src={img(p.photo)} alt={p.name} /> : <div className={'ph ' + cls}>{p.name?.[0]}</div>
const Cert = ({ on, small }) => <span className={'cert-badge' + (small ? ' sm' : '')} title={`Certified member since ${fmt(on)}`}>
  ✓ Certified member{!small && <em> since {fmt(on)}</em>}</span>

export default function App() {
  const [me, setMe] = useState(undefined); const [open, setOpen] = useState(false); const loc = useLocation()
  const refresh = () => api('player_me').then(d => setMe(d.player)).catch(() => setMe(null))
  useEffect(() => { refresh() }, [])
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [loc.pathname])
  const links = [['/', 'Home'], ['/news', 'News'], ['/matches', 'Matches'], ['/members', 'Members'], ['/gallery', 'Gallery'], ['/club', 'The Club'],
    me ? ['/account', 'My profile'] : ['/login', 'Player login'], ...(me ? [] : [['/register', 'Join the team']])]
  return (<>
    <header className="top"><Link to="/" className="logo"><img src={import.meta.env.BASE_URL + "logo.png"} alt="" />All Stars FC</Link>
      <button className="burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /><span /></button>
      <nav className={open ? 'open' : ''}>{links.map(([to, l]) => <NavLink key={to} to={to} end={to === '/'}>{l}</NavLink>)}</nav></header>
    <main><Routes>
      <Route path="/" element={<Home />} /><Route path="/news" element={<News />} /><Route path="/matches" element={<Matches />} />
      <Route path="/members" element={<Members />} /><Route path="/player/:id" element={<Player />} />
      <Route path="/gallery" element={<Gallery />} /><Route path="/club" element={<Club />} />
      <Route path="/register" element={<Register refresh={refresh} />} />
      <Route path="/login" element={<Login refresh={refresh} />} /><Route path="/account" element={<Account me={me} refresh={refresh} />} />
      <Route path="/admin" element={<Admin />} />
    </Routes></main>
    <footer>All Stars FC · Every Sunday, 4:00pm kick-off · <Link to="/admin">Admin</Link></footer>
  </>)
}

function Hero({ slides, mode, next }) {
  const ref = useRef(null); const [i, setI] = useState(0)
  const scroll = mode !== 'static' && slides.length > 1
  const list = slides.length ? (scroll ? slides : slides.slice(0, 1)) : [{ id: 0 }]
  const go = k => { const el = ref.current; if (el) el.scrollTo({ left: ((k + list.length) % list.length) * el.clientWidth, behavior: 'smooth' }) }
  useEffect(() => { if (!scroll) return; const t = setTimeout(() => go(i + 1), 6000); return () => clearTimeout(t) }, [scroll, i, list.length])
  return (<section className="hero">
    <div ref={ref} className={'track' + (scroll ? '' : ' static')} onScroll={e => setI(Math.round(e.target.scrollLeft / e.target.clientWidth))}>
      {list.map(s => <div key={s.id} className="slide" style={s.image ? { backgroundImage: `url(${img(s.image)})` } : {}}>
        <div className="hero-in"><h1>{s.caption || 'All Stars FC'}</h1>
          {next && <p className="next">Next up: <b>{next.opponent}</b>, {fmt(next.match_date)}{next.venue && ` at ${next.venue}`}</p>}
          <Link className="btn" to="/register">Join the squad</Link></div></div>)}
    </div>
    {scroll && <>
      <button className="arrow l" aria-label="Previous image" onClick={() => go(i - 1)}>‹</button>
      <button className="arrow r" aria-label="Next image" onClick={() => go(i + 1)}>›</button>
      <div className="dots">{list.map((_, k) => <button key={k} aria-label={`Image ${k + 1}`} className={k === i ? 'on' : ''} onClick={() => go(k)} />)}</div></>}
  </section>)
}

function Home() {
  const d = useApi('home')
  if (d === null) return <p className="empty">Loading…</p>
  if (!d) return <Empty>Can't reach the server. Start Apache and MySQL in XAMPP.</Empty>
  const max = Math.max(1, ...d.scorers.map(s => +s.goals))
  return (<>
    <Hero slides={d.hero} mode={d.hero_mode} next={d.next} />
    <div className="wrap tight"><Glance /><p><Link to="/club">Club rules and how to join</Link></p></div>
    <div className="wrap grid2">
      <section><h2>This week at the club</h2>
          {d.news.length ? d.news.map(n => <NewsBanner key={n.id} n={n} />) : <Empty>No news yet. Check back after the weekend.</Empty>}
        <Link to="/news">All news</Link></section>
      <aside>
        <h2>Player of the month</h2>
        {d.potm ? <Link to={`/player/${d.potm.player_id}`} className="potm">
          <Face p={d.potm} /><div><small>{d.potm.month}</small><h3>{d.potm.name}</h3><p>{d.potm.note}</p></div></Link> : <Empty>Not chosen yet.</Empty>}
      </aside>
    </div>
    <section className="band"><div className="wrap"><h2>Goal chart</h2>
      {d.scorers.length ? d.scorers.map(s => <Link to={`/player/${s.id}`} key={s.id} className="bar">
        <span>{s.name}</span><i style={{ width: `${(s.goals / max) * 100}%` }} /><b>{s.goals}</b></Link>) : <Empty>No goals recorded yet.</Empty>}
    </div></section>
  </>)
}

function NewsBanner({ n }) {
  const d = new Date(n.created_at)
  return <article className="nb">
    <div className="sb nb-row">
      <div className="sb-logo l"><img src={LOGO} alt="" /></div>
      <h3 className="sb-team nb-title">{n.title}</h3>
      <div className="sb-mid nb-date"><time>NEWS</time><b><small>{d.toLocaleDateString('en-GB', { month: 'short' })}</small>{d.getDate()}</b></div>
    </div>
    {n.body && <p className="nb-body">{n.body}</p>}
  </article>
}

function Scoreboard({ m }) {
  const played = +m.played
  return <article className="match">
    <div className="sb">
      <div className="sb-logo l"><img src={LOGO} alt="All Stars FC" /></div>
      <div className="sb-team">All Stars FC</div>
      <div className="sb-mid"><time>{fmt(m.match_date)}</time><b>{played ? `${m.home_score} - ${m.away_score}` : 'VS'}</b></div>
      <div className="sb-team">{m.opponent}</div>
      <div className="sb-logo r">{m.opponent_logo ? <img src={img(m.opponent_logo)} alt={m.opponent} /> : <span>{m.opponent[0]}</span>}</div>
    </div>
    <p className="sb-venue">{m.venue || ''}{!played && ' · Kick-off to be confirmed'}</p>
    {m.scorers?.length > 0 && <div className="scorers"><small>Goals</small>
      {m.scorers.map(s => <Link key={s.pid} to={`/player/${s.pid}`}>{s.name}{+s.qty > 1 && ` ×${s.qty}`}</Link>)}</div>}
  </article>
}

function News() {
  const n = useApi('list', { t: 'news' })
  return <div className="wrap mid"><h1>News</h1>{n?.length ? n.map(x => <NewsBanner key={x.id} n={x} />) : <Empty>No news yet.</Empty>}</div>
}

function Matches() {
  const m = useApi('list', { t: 'matches' })
  const up = m?.filter(x => !+x.played).reverse() || []
  const done = m?.filter(x => +x.played) || []
  return <div className="wrap mid"><h1>Matches</h1>
    {m && !m.length && <Empty>No fixtures yet.</Empty>}
    {up.length > 0 && <><h2>Upcoming</h2>{up.map(x => <Scoreboard key={x.id} m={x} />)}</>}
    {done.length > 0 && <><h2>Results</h2>{done.map(x => <Scoreboard key={x.id} m={x} />)}</>}</div>
}

function Members() {
  const p = useApi('list', { t: 'players' })
  return <div className="wrap"><h1>The squad</h1>
    {p?.length ? <div className="cards">{p.map(x => <Link key={x.id} to={`/player/${x.id}`} className="card">
      <Face p={x} /><div><h3>{x.name}</h3><small>{x.shirt_no ? `#${x.shirt_no} · ` : ''}{x.position}</small>
        {x.certified_on && <div><Cert on={x.certified_on} small /></div>}<p>{x.bio?.slice(0, 110)}</p></div></Link>)}</div>
      : <Empty>Nobody has registered yet. <Link to="/register">Be the first</Link>.</Empty>}</div>
}

function Player() {
  const { id } = useParams(); const p = useApi('player', { id })
  if (!p) return <Empty>Loading player…</Empty>
  const parts = p.name.trim().split(/\s+/); const last = parts.length > 1 ? parts.pop() : ''
  const rows = [['Nationality', p.nationality], ['D.O.B', p.dob && fmt(p.dob)], ['Position', p.position], ['Alternate position', p.alt_position],
    ['Height', p.height], ['Weight', p.weight], ['Preferred foot', p.foot], ['Shirt number', p.shirt_no],
    ['State of origin', p.state_origin], ['State of residence', p.state_residence]].filter(r => r[1])
  const career = p.career?.split('\n').filter(Boolean) || []
  const shots = [p.photo2, p.photo3].filter(Boolean)
  return (<div className="pc">
    <div className="pc-main">
      <h1 className="pc-name">{parts.join(' ')}{last && <span>{last}</span>}</h1>
            {p.certified_on && <div><Cert on={p.certified_on} /></div>}
      <div className="pc-panel">
        {p.bio && <p>{p.bio}</p>}
        {rows.length > 0 && <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
        {(p.current_club || career.length > 0) && <div className="pc-club">
          {p.current_club && <div className="badge"><small>Current club</small><b>{p.current_club}</b></div>}
          {career.length > 0 && <div><h3>Career history</h3>{career.map((c, i) => <p key={i}>{c}</p>)}</div>}</div>}
        <p className="pc-stats"><b>{p.goals}</b> goals for All Stars{p.awards?.length > 0 && <> · Player of the month: {p.awards.join(', ')}</>}</p>
      </div>
      {shots.length > 0 && <div className="pc-shots">{shots.map(s => <img key={s} src={img(s)} alt="" />)}</div>}
      {(p.phone || p.contact_email) && <div className="pc-contact">
        {p.phone && <a href={`tel:${p.phone}`}>{p.phone}</a>}{p.contact_email && <a href={`mailto:${p.contact_email}`}>{p.contact_email}</a>}</div>}
    </div>
    <div className="pc-photo">{p.photo ? <img src={img(p.photo)} alt={p.name} /> : <div className="ph">{p.name[0]}</div>}</div>
  </div>)
}

function Gallery() {
  const g = useApi('list', { t: 'gallery' }); const [open, setOpen] = useState(null)
  const [type, setType] = useState('all'); const [cat, setCat] = useState('all')
  const cats = [...new Set(g?.map(x => x.category))]
  const shown = g?.filter(x => (type === 'all' || x.type === type) && (cat === 'all' || x.category === cat))
  const Chip = ({ v, cur, set, children }) => <button className={'chip' + (cur === v ? ' on' : '')} onClick={() => set(v)}>{children}</button>
  return <div className="wrap"><h1>Gallery</h1>
    {g?.length > 0 && <div className="filters">
      <div>{[['all', 'All'], ['image', 'Photos'], ['video', 'Videos']].map(([v, l]) => <Chip key={v} v={v} cur={type} set={setType}>{l}</Chip>)}</div>
      </div>}
    {shown?.length ? <div className="gal">{shown.map(x => <figure key={x.id}>
      <div className="tile">{x.type === 'video' ? <video src={img(x.file)} controls preload="metadata" /> : <img src={img(x.file)} alt={x.caption || ''} onClick={() => setOpen(x)} />}</div>
      <figcaption><small>{x.category}</small>{x.caption && <span>{x.caption}</span>}</figcaption></figure>)}</div>
      : <Empty>{g?.length ? 'Nothing matches those filters.' : 'No photos or videos yet.'}</Empty>}
    {open && <div className="lightbox" onClick={() => setOpen(null)}><img src={img(open.file)} alt="" /></div>}</div>
}

function Register({ refresh }) {
  const nav = useNavigate(); const [err, setErr] = useState('')
  const submit = async e => {
    e.preventDefault(); setErr('')
      try { await api('register', { method: 'POST', body: new FormData(e.target) }); await refresh(); nav('/account') } catch (x) { setErr(x.message) }
  }
  return <div className="wrap narrow"><h1>Join the squad</h1>
      <p>Your profile goes live straight away. Full membership needs the ₦10,000 joining fee and the executives’ approval. After that, the admin certifies you.</p>
    <form onSubmit={submit} className="form">
      <label>Full name<input name="name" required /></label>
      <label>Introduced by (an existing member)<input name="introduced_by" required /></label>
      <label>Email<input name="email" type="email" required /></label>
      <label>Password (6+ characters)<input name="password" type="password" minLength="6" required /></label>
      <label>Position<select name="position">{['Goalkeeper', 'Defender', 'Midfielder', 'Forward'].map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Shirt number<input name="shirt_no" type="number" min="1" max="99" /></label>
      <label>About you<textarea name="bio" rows="4" placeholder="Strengths, favourite club, one fun fact" /></label>
      <label>Photo<input name="photo" type="file" accept="image/*" /></label>
      <label className="agree"><input type="checkbox" required /> I have read the <Link to="/club">club rules</Link> and agree to follow them.</label>
      {err && <p className="err">{err}</p>}<button className="btn">Create my profile</button></form></div>
}

const CATS = ['Match Day', 'Training', 'Social', 'Awards', 'General']

function Login({ refresh }) {
  const nav = useNavigate(); const [err, setErr] = useState('')
  const submit = async e => {
    e.preventDefault(); setErr('')
    try { await api('player_login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); await refresh(); nav('/account') } catch (x) { setErr(x.message) }
  }
  return <div className="wrap narrow"><h1>Player login</h1>
    <form className="form" onSubmit={submit}>
      <label>Email<input name="email" type="email" required /></label>
      <label>Password<input name="password" type="password" required /></label>
      {err && <p className="err">{err}</p>}<button className="btn">Log in</button></form>
    <p>Not a member yet? <Link to="/register">Join the team</Link>.</p></div>
}

const MORE = [['nationality', 'Nationality'], ['dob', 'Date of birth', 'date'], ['height', 'Height (e.g. 1.70m)'], ['weight', 'Weight (e.g. 60kg)'],
  ['foot', 'Preferred foot', 'foot'], ['alt_position', 'Alternate position'], ['state_origin', 'State of origin'], ['state_residence', 'State of residence'],
  ['current_club', 'Current club'], ['phone', 'Phone (shown publicly, optional)', 'tel'], ['contact_email', 'Contact email (shown publicly, optional)', 'email']]

function Account({ me, refresh }) {
  const nav = useNavigate(); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [prev, setPrev] = useState('')
  if (me === undefined) return null
  if (!me) return <div className="wrap narrow"><Empty>Please <Link to="/login">log in</Link> to edit your profile.</Empty></div>
  const save = async e => {
    e.preventDefault(); setMsg(''); setErr('')
    const f = e.target
    try {
      await api('player_update', { method: 'POST', body: new FormData(f) })
      await refresh(); setPrev(''); ['photo', 'photo2', 'photo3', 'current_password', 'new_password'].forEach(k => f[k].value = '')
      setMsg('Saved. Your changes are now live on your public profile and the Members page.')
    } catch (x) { setErr(x.message) }
  }
  const logout = async () => { await api('player_logout'); await refresh(); nav('/') }
  const field = ([k, l, ty]) => <label key={k}>{l}{ty === 'foot'
    ? <select name={k} defaultValue={me[k] || ''}><option value="">Not set</option>{['Left', 'Right', 'Both'].map(x => <option key={x}>{x}</option>)}</select>
    : <input name={k} type={ty || 'text'} defaultValue={me[k] ?? ''} />}</label>
  return <div className="wrap profile">
    <div>{prev ? <img className="big" src={prev} alt="Preview" /> : <Face p={me} cls="big" />}</div>
    <form className="form" onSubmit={save}>
      <h1>My profile</h1>
      <p className="status">{me.certified_on ? <Cert on={me.certified_on} /> : 'Membership: not yet certified. The admin certifies members once dues are paid.'}</p>
      <label>Full picture (main photo)<input name="photo" type="file" accept="image/*" onChange={e => setPrev(e.target.files[0] ? URL.createObjectURL(e.target.files[0]) : '')} /></label>
      <label>Action photo 1<input name="photo2" type="file" accept="image/*" /></label>
      <label>Action photo 2<input name="photo3" type="file" accept="image/*" /></label>
      <label>Full name<input name="name" defaultValue={me.name} required /></label>
      <label>Email (used to log in, never shown)<input value={me.email} disabled /></label>
      <label>Position<select name="position" defaultValue={me.position || 'Midfielder'}>{['Goalkeeper', 'Defender', 'Midfielder', 'Forward'].map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Shirt number<input name="shirt_no" type="number" min="1" max="99" defaultValue={me.shirt_no ?? ''} /></label>
      {MORE.map(field)}
      <label>About you<textarea name="bio" rows="5" defaultValue={me.bio || ''} /></label>
      <label>Career history (one club per line)<textarea name="career" rows="4" placeholder={'Piloters F.C. (2021-2023)\nBoro F.A. (2014-2021)'} defaultValue={me.career || ''} /></label>
      <fieldset><legend>Change password (optional)</legend>
        <label>Current password<input name="current_password" type="password" autoComplete="current-password" /></label>
        <label>New password<input name="new_password" type="password" minLength="6" autoComplete="new-password" /></label></fieldset>
      {err && <p className="err">{err}</p>}{msg && <p className="ok">{msg}</p>}
      <div className="actions"><button className="btn">Save changes</button><Link to={`/player/${me.id}`}>View my public profile</Link>
        <button type="button" className="link" onClick={logout}>Log out</button></div>
    </form></div>
}

const Glance = ({ col }) => <div className={'glance' + (col ? ' col' : '')}>{GLANCE.map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>

function Club() {
  const [tab, setTab] = useState('about'); const [rule, setRule] = useState(0)
  return <>
    <section className="club-hero">
      <img src={import.meta.env.BASE_URL + 'logo.png'} alt="" />
      <div><h1>All Stars FC</h1><p>{INTRO[0]}</p></div>
    </section>
    <div className="subtabs" role="tablist">
      {[['about', 'About the club'], ['rules', 'Rules and fines']].map(([k, l]) =>
        <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
    </div>

    {tab === 'about' ? <div className="wrap">
      <div className="about">
        <div>{INTRO.slice(1).map((t, i) => <p key={i} className={i === 0 ? 'lead' : ''}>{t}</p>)}</div>
        <div><h2>Matchday</h2><Glance col /></div>
      </div>
      <h2>How to join</h2>
      <ol className="jsteps">{JOIN.map((s, i) => <li key={s}><b>{i + 1}</b><p>{s}</p></li>)}</ol>
      <Link className="btn" to="/register">Register now</Link>
    </div> : <div className="wrap">
      <h2>Fines at a glance</h2>
      <div className="fines">{FINES.map(([a, b]) => <div key={a}><small>{a}</small><b>{b}</b></div>)}</div>
      <h2>Club rules and regulations</h2>
      <div className="rules">
        <nav aria-label="Rule sections">{RULES.map(([t], i) => <button key={t} className={rule === i ? 'on' : ''} onClick={() => setRule(i)}>{t}</button>)}</nav>
        <div className="panel"><h3>{RULES[rule][0]}</h3><ol>{RULES[rule][1].map(x => <li key={x}>{x}</li>)}</ol></div>
      </div>
    </div>}
  </>
}

const SECTIONS = {
  hero_images: ['Hero images', [['caption', 'Headline on image'], ['sort_order', 'Order', 'number'], ['file', 'Image', 'file']]],
  news: ['News', [['title', 'Title'], ['body', 'Story', 'textarea']]],
  potm: ['Player of month', [['month', 'Month', 'month'], ['player_id', 'Player', 'player'], ['note', 'Why they won']]],
  matches: ['Matches', [['opponent', 'Opponent'], ['file', 'Opponent logo (optional)', 'file'], ['match_date', 'Date', 'date'], ['venue', 'Venue'], ['home_score', 'All Stars goals', 'number'], ['away_score', 'Opponent goals', 'number'], ['played', 'Played', 'check']]],
  goals: ['Goals', [['player_id', 'Scorer', 'player'], ['match_id', 'Match', 'match'], ['qty', 'Goals', 'number']]],
  gallery: ['Gallery', [['caption', 'Caption'], ['category', 'Category', 'category'], ['file', 'Photo or video', 'file']]],
  players: ['Players', []],
}

function Section({ t }) {
  const [label, fields] = SECTIONS[t]; const [n, setN] = useState(0); const [err, setErr] = useState('')
  const rows = useApi(t === 'players' ? 'admin_players' : 'list', { t }, n); const players = useApi('list', { t: 'players' })
    const ms = useApi('list', { t: 'matches' }, n)
  const result = async r => {
    const a = prompt(`All Stars goals vs ${r.opponent}?`, r.home_score ?? 0); if (a === null) return
    const b = prompt(`${r.opponent} goals?`, r.away_score ?? 0); if (b === null) return
    await api('admin', { method: 'POST', params: { t }, body: { id: r.id, home_score: a, away_score: b } }); setN(n + 1)
  }
  const add = async e => { e.preventDefault(); setErr('')
    try { await api('admin', { method: 'POST', params: { t }, body: new FormData(e.target) }); e.target.reset(); setN(n + 1) } catch (x) { setErr(x.message) } }
  const del = async id => { if (confirm('Delete this?')) { await api('admin', { method: 'DELETE', params: { t, id } }); setN(n + 1) } }
  const certify = async r => { await api('admin', { method: 'POST', params: { t }, body: { id: r.id, certify: r.certified_on ? 0 : 1 } }); setN(n + 1) }
  const multi = t === 'hero_images'
     const input = ([k, l, ty]) => <label key={k}>{l}{ty === 'textarea' ? <textarea name={k} rows="4" />
    : ty === 'player' ? <select name={k} required>{players?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
    : ty === 'match' ? <select name={k}><option value="">No specific match</option>{ms?.map(x => <option key={x.id} value={x.id}>{x.opponent} · {fmt(x.match_date)}</option>)}</select>
    : ty === 'category' ? <select name={k}>{CATS.map(c => <option key={c}>{c}</option>)}</select>
    : ty === 'check' ? <input name={k} type="checkbox" value="1" />
    : ty === 'file' ? <input name={multi ? 'file[]' : 'file'} type="file" multiple={multi} required={t !== 'matches'} accept={t === 'gallery' ? 'image/*,video/mp4,video/webm' : 'image/*'} />
    : <input name={k} type={ty || 'text'} required={['title', 'opponent', 'match_date', 'month'].includes(k)} />}</label>
  return (<div><h2>{label}</h2>
    {fields.length > 0 && <form className="form" onSubmit={add}>{fields.map(input)}{err && <p className="err">{err}</p>}<button className="btn">{multi ? 'Upload' : 'Add'}</button></form>}
        <ul className="rows">{rows?.map(r => <li key={r.id}>
      <span>{r.image && <img className="thumb" src={img(r.image)} alt="" />}{[r.title, r.opponent, r.name, r.month, r.caption, r.qty && `x${r.qty}`].filter(Boolean).join(' · ') || `#${r.id}`}
        {r.certified_on && <em className="since"> ✓ certified {fmt(r.certified_on)}</em>}</span>
        {r.introduced_by && <em className="since"> · introduced by {r.introduced_by}</em>}
        <span className="btns">
        {t === 'matches' && <button className="ok-btn" onClick={() => result(r)}>{+r.played ? 'Edit result' : 'Set result'}</button>}
        {t === 'players' && <button className={'cert' + (r.certified_on ? ' on' : '')} onClick={() => certify(r)}>{r.certified_on ? 'Revoke' : 'Certify'}</button>}
        <button onClick={() => del(r.id)}>Delete</button></span>
        </li>)}
        </ul>
        </div>)
}

function HeroMode() {
  const [mode, setMode] = useState(null)
  useEffect(() => { api('hero_mode').then(d => setMode(d.mode)) }, [])
  const set = async m => { setMode(m); await api('hero_mode', { method: 'POST', body: { mode: m } }) }
  if (!mode) return null
  return <fieldset className="mode"><legend>Hero style</legend>
    {[['scroll', 'Scrollable slideshow (all hero images)'], ['static', 'Static (first image only)']].map(([v, l]) =>
      <label key={v}><input type="radio" name="mode" checked={mode === v} onChange={() => set(v)} />{l}</label>)}
    <small>In static mode the image with the lowest Order number is shown.</small></fieldset>
}

function Admin() {
  const [auth, setAuth] = useState(null); const [err, setErr] = useState(''); const [tab, setTab] = useState('hero_images')
  useEffect(() => { api('me').then(d => setAuth(d.admin)) }, [])
  const login = async e => { e.preventDefault(); try { await api('login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); setAuth(true) } catch (x) { setErr(x.message) } }
  if (auth === null) return null
  if (!auth) return <div className="wrap narrow"><h1>Admin login</h1><form className="form" onSubmit={login}>
    <label>Username<input name="username" required /></label><label>Password<input name="password" type="password" required /></label>
    {err && <p className="err">{err}</p>}<button className="btn">Log in</button></form></div>
  return <div className="wrap"><h1>Admin</h1>
    <div className="tabs">{Object.entries(SECTIONS).map(([k, [l]]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      <button onClick={async () => { await api('logout'); setAuth(false) }}>Log out</button></div>
        {tab === 'hero_images' && <HeroMode />}<Section key={tab} t={tab} /></div>
}
