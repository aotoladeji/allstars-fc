import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Routes, Route, NavLink, Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { ACTION_END, ACTION_MESSAGE, ACTION_START, api, formData, img, notifyDataChanged, notifySuccess, runAction, uploadToCloud, useApi } from './api'
import { INTRO, GLANCE, JOIN, FINES, RULES } from './clubInfo'

const DEFAULT_LOGO = import.meta.env.BASE_URL + 'llg.png'
const LogoContext = createContext(DEFAULT_LOGO)
const useLogo = () => useContext(LogoContext)
const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const Empty = ({ children }) => <p className="empty">{children}</p>
const Face = ({ p, cls = '' }) => p.photo ? <img className={cls} src={img(p.photo)} alt={p.name} /> : <div className={'ph ' + cls}>{p.name?.[0]}</div>
const Cert = ({ on, small }) => <span className={'cert-badge' + (small ? ' sm' : '')} title={`Certified member since ${fmt(on)}`}>
  ✓ Certified member{!small && <em> since {fmt(on)}</em>}</span>
const Spin = () => <i className="spin" aria-hidden="true" />
const useBusyAction = () => {
  const [busy, setBusy] = useState(false)
  const run = async (task, success) => {
    setBusy(true)
    try { return await runAction(task, success) } finally { setBusy(false) }
  }
  return [busy, run]
}
const Feedback = () => {
  const [pending, setPending] = useState(0)
  const [toast, setToast] = useState(null)
  useEffect(() => {
    const start = () => setPending(n => n + 1)
    const end = () => setPending(n => Math.max(0, n - 1))
    const onMessage = e => setToast({ ...e.detail, id: Date.now() + Math.random() })
    window.addEventListener(ACTION_START, start)
    window.addEventListener(ACTION_END, end)
    window.addEventListener(ACTION_MESSAGE, onMessage)
    return () => {
      window.removeEventListener(ACTION_START, start)
      window.removeEventListener(ACTION_END, end)
      window.removeEventListener(ACTION_MESSAGE, onMessage)
    }
  }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t) }, [toast])
  return <>
    {pending > 0 && <div className="busy-bar"><i /></div>}
    {toast && <div className={'toast ' + (toast.type === 'error' ? 'err' : 'ok')} role="status">{toast.text}<button aria-label="Dismiss" onClick={() => setToast(null)}>×</button></div>}
  </>
}

const site = () => window.location.origin + window.location.pathname
const shareLink = (hash, u) => u || (site() + hash)
const doShare = async (title, text, url) => {
  if (navigator.share) { try { await navigator.share({ title, text, url }); notifySuccess('Shared.') } catch {} return }
  let copied = false
  try { await navigator.clipboard.writeText(url); copied = true } catch {}
  const enc = encodeURIComponent(url), et = encodeURIComponent(text || title)
  window.open(`https://wa.me/?text=${et}%20${enc}`, '_blank')
  notifySuccess(copied ? 'Link copied.' : 'Share link ready.')
}
const ShareBtn = ({ title, text, url, hash, cls = '' }) => <button type="button" className={'icon-btn' + (cls ? ' ' + cls : '')} onClick={e => { e.preventDefault(); e.stopPropagation(); doShare(title, text, shareLink(hash, url)) }}>Share</button>
const StatBar = ({ likes = 0, views, comments, liked, busy, onLike, onComment }) => <div className="statbar">
  <button type="button" className={'icon-btn' + (liked ? ' liked' : '')} disabled={busy} onClick={e => { e.preventDefault(); e.stopPropagation(); onLike && onLike() }}>{busy && <Spin />}♥ {likes}</button>
  {views != null && <span className="stat">👁 {views}</span>}
  {comments != null && <button type="button" className="icon-btn" disabled={busy} onClick={e => { e.preventDefault(); e.stopPropagation(); onComment && onComment() }}>{busy && <Spin />}💬 {comments}</button>}
</div>

export default function App() {
  const [me, setMe] = useState(undefined); const [open, setOpen] = useState(false); const loc = useLocation()
  const [brand, setBrand] = useState(null)
  const loadBrand = () => api('branding').then(setBrand).catch(() => setBrand(null))
  useEffect(() => {
    loadBrand()
    const onBrand = () => loadBrand()
    window.addEventListener('club-logo-changed', onBrand)
    return () => window.removeEventListener('club-logo-changed', onBrand)
  }, [])
  const logo = brand?.club_logo ? img(brand.club_logo) : DEFAULT_LOGO
  const refresh = () => api('player_me').then(d => setMe(d.player)).catch(() => setMe(null))
  useEffect(() => { refresh() }, [])
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [loc.pathname])
  const links = [['/', 'Home'], ['/news', 'News'], ['/matches', 'Matches'], ['/members', 'Members'], ['/execos', 'Excos'], ['/gallery', 'Gallery'], ['/club', 'The Club'],
    me ? ['/account', 'My profile'] : ['/login', 'Player login'], ...(me ? [] : [['/register', 'Join the team']])]
  return (<LogoContext.Provider value={logo}>
    <Feedback />
    <header className="top"><Link to="/" className="logo"><img src={logo} alt="" />All Stars FC</Link>
      <button className="burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /><span /></button>
      <nav className={open ? 'open' : ''}>{links.map(([to, l]) => <NavLink key={to} to={to} end={to === '/'}>{l}</NavLink>)}</nav></header>
    <main><Routes>
      <Route path="/" element={<Home />} /><Route path="/news" element={<News />} /><Route path="/matches" element={<Matches />} />
      <Route path="/members" element={<Members />} /><Route path="/execos" element={<Excos />} /><Route path="/player/:id" element={<Player />} />
      <Route path="/gallery" element={<Gallery />} /><Route path="/club" element={<Club />} />
      <Route path="/register" element={<Register refresh={refresh} />} />
      <Route path="/login" element={<Login refresh={refresh} />} /><Route path="/account" element={<Account me={me} refresh={refresh} />} />
      <Route path="/admin" element={<Admin />} />
    </Routes></main>
    <footer>All Stars FC · Every Sunday, 4:00pm kick-off · <Link to="/admin">Admin</Link></footer>
  </LogoContext.Provider>)
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

function Highlight({ h }) {
  const [open, setOpen] = useState(false)
  const [st, setSt] = useState(null)
  const [liked, setLiked] = useState(false)
  const [busy, run] = useBusyAction()
  useEffect(() => { if (h) { setSt({ likes: +h.likes || 0, views: +h.views || 0 }); setLiked(false); api('engage', { method: 'POST', params: { t: 'highlights', id: h.id, action: 'view' } }).then(d => d && setSt(s => ({ ...s, ...d }))).catch(()=>{}) } }, [h?.id])
  if (!h) return null
  const like = async () => { if (liked || busy) return; try { const d = await run(() => api('engage', { method: 'POST', params: { t: 'highlights', id: h.id, action: 'like' } }), 'Like added.'); setSt(s => ({ ...s, ...d })); setLiked(true) } catch {} }
  const shareUrl = shareLink('#/')
  return <>
    <section className="highlight">
      <div className="wrap wide highlight-card">
        <div className="highlight-grid">
          <div className="highlight-img"><img src={img(h.image)} alt={h.title || ''} /></div>
          <div className="highlight-text">
            <small className="highlight-kicker">{h.category === 'month' ? 'Highlight of the Month' : 'Highlight of the Week'}</small>
            {h.title && <h2>{h.title}</h2>}
            {h.subtitle && <h3>{h.subtitle}</h3>}
            {h.body && <p className="hl-body">{h.body.length > 180 ? h.body.slice(0, 177) + '...' : h.body}</p>}
            <div className="actions-row">
              <StatBar likes={st?.likes ?? 0} views={st?.views ?? 0} liked={liked} busy={busy} onLike={like} />
              <ShareBtn title={h.title || 'Highlight'} text={h.subtitle || h.title || 'Check this out'} url={shareUrl} />
              {(h.body || h.subtitle) ? <button className="hl-read" onClick={() => setOpen(true)}>View</button> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
    {open && <div className="hl-modal" onClick={() => setOpen(false)}>
      <div className="hl-modal-inner" onClick={e => e.stopPropagation()}>
        <button className="hl-close" onClick={() => setOpen(false)}>×</button>
        <img className="hl-modal-img" src={img(h.image)} alt={h.title || ''} />
        <div className="hl-modal-content">
          <small className="highlight-kicker">{h.category === 'month' ? 'Highlight of the Month' : 'Highlight of the Week'}</small>
          {h.title && <h2>{h.title}</h2>}
          {h.subtitle && <h3>{h.subtitle}</h3>}
          {h.body && <p>{h.body}</p>}
          <div className="actions-row"><StatBar likes={st?.likes ?? 0} views={st?.views ?? 0} liked={liked} busy={busy} onLike={like} /><ShareBtn title={h.title || 'Highlight'} text={h.subtitle || h.title || ''} url={shareUrl} /></div>
        </div>
      </div>
    </div>}
  </>
}

function Home() {
  const d = useApi('home')
  const [range, setRange] = useState('all')
  if (d === null) return <p className="empty">Loading…</p>
  if (!d) return <Empty>Can't reach the server. Start Apache and MySQL in XAMPP.</Empty>
  const scorers = (range === 'month' ? d.scorers_month : range === 'year' ? d.scorers_year : d.scorers) || []
  const max = Math.max(1, ...scorers.map(s => +s.goals))
  return (<>
    <Hero slides={d.hero} mode={d.hero_mode} next={d.next} />
    <div className="wrap tight"><Glance /><p><Link to="/club">Club rules and how to join</Link></p></div>
    <Highlight h={d.highlight} />
    <div className="wrap grid2">
      <section><h2>Announcements</h2>
          {d.news.length ? d.news.map(n => <NewsBanner key={n.id} n={n} />) : <Empty>No news yet. Check back after the weekend.</Empty>}
        <Link to="/news">All news</Link></section>
      <aside>
        <h2>Player of the month</h2>
        {d.potm ? <PotmHome p={d.potm} /> : <Empty>Not chosen yet.</Empty>}
      </aside>
    </div>
    <section className="band"><div className="wrap"><h2>Goal chart</h2>
      <div className="filters">{[['all', 'Overall'], ['year', 'This year'], ['month', 'This month']].map(([v, l]) =>
        <button key={v} className={'chip' + (range === v ? ' on' : '')} onClick={() => setRange(v)}>{l}</button>)}</div>
      {scorers.length ? scorers.map(s => <Link to={`/player/${s.id}`} key={s.id} className="bar">
        <span>{s.name}</span><i style={{ width: `${(s.goals / max) * 100}%` }} /><b>{s.goals}</b></Link>)
        : <Empty>{range === 'all' ? 'No goals recorded yet.' : `No goals recorded ${range === 'month' ? 'this month' : 'this year'} yet.`}</Empty>}
    </div></section>
  </>)
}

function PotmHome({ p }) {
  const [st, setSt] = useState({ likes: +p.likes || 0, views: +p.views || 0 })
  const [liked, setLiked] = useState(false)
  const [busy, run] = useBusyAction()
  useEffect(() => { setSt({ likes: +p.likes || 0, views: +p.views || 0 }); setLiked(false); api('engage', { method: 'POST', params: { t: 'potm', id: p.id, action: 'view' } }).then(d => d && setSt(s => ({ ...s, ...d }))).catch(()=>{}) }, [p.id])
  const like = async () => { if (liked || busy) return; try { const d = await run(() => api('engage', { method: 'POST', params: { t: 'potm', id: p.id, action: 'like' } }), 'Like added.'); setSt(s => ({ ...s, ...d })); setLiked(true) } catch {} }
  return <div className="potm-card">
    <Link to={`/player/${p.player_id}`} className="potm-bg" style={(p.potm_image || p.photo) ? { backgroundImage: `url(${img(p.potm_image || p.photo)})` } : {}}>
      <div className="potm-overlay">
        <div className="potm-meta">
          <small>PLAYER OF THE MONTH</small>
          <h3>{p.name}</h3>
          <span>{p.month}</span>
        </div>
      </div>
    </Link>
    {p.note && <div className="potm-note"><p>{p.note}</p></div>}
    <div className="potm-actions actions-row">
      <StatBar likes={st.likes} views={st.views} liked={liked} busy={busy} onLike={like} />
      <ShareBtn title={`Player of the Month: ${p.name}`} text={`${p.name} is Player of the Month (${p.month})`} url={shareLink(`#/player/${p.player_id}`)} />
    </div>
  </div>
}

function NewsBanner({ n }) {
  const d = new Date(n.created_at); const logo = useLogo()
  return <article className="nb">
    <div className="sb nb-row">
      <div className="sb-logo l"><img src={logo} alt="" /></div>
      <h3 className="sb-team nb-title">{n.title}</h3>
      <div className="sb-mid nb-date"><time>NEWS</time><b><small>{d.toLocaleDateString('en-GB', { month: 'short' })}</small>{d.getDate()}</b></div>
    </div>
    {n.body && <p className="nb-body">{n.body}</p>}
  </article>
}

function Scoreboard({ m }) {
  const played = +m.played; const logo = useLogo()
  const title = `All Stars FC vs ${m.opponent}`
  const text = played ? `${title} ${m.home_score}-${m.away_score} (${fmt(m.match_date)})` : `${title} on ${fmt(m.match_date)}${m.venue ? ' at ' + m.venue : ''}`
  return <article className="match">
    <div className="sb">
      <div className="sb-logo l"><img src={logo} alt="All Stars FC" /></div>
      <div className="sb-team">All Stars FC</div>
      <div className="sb-mid"><time>{fmt(m.match_date)}</time><b>{played ? `${m.home_score} - ${m.away_score}` : 'VS'}</b></div>
      <div className="sb-team">{m.opponent}</div>
      <div className="sb-logo r">{m.opponent_logo ? <img src={img(m.opponent_logo)} alt={m.opponent} /> : <span>{m.opponent[0]}</span>}</div>
    </div>
    <p className="sb-venue">{m.venue || ''}{!played && ' • Kick-off to be confirmed'}</p>
    {m.scorers?.length > 0 && <div className="scorers"><small>Goals</small>
      {m.scorers.map(s => <Link key={s.pid} to={`/player/${s.pid}`}>{s.name}{+s.qty > 1 && ` ×${s.qty}`}</Link>)}</div>}
    <div className="actions-row center"><ShareBtn title={title} text={text} url={shareLink('#/matches')} /></div>
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
        {x.certified_on && <div><Cert on={x.certified_on} small /></div>}<p>{x.bio?.slice(0, 110)}</p>
        <div className="actions-row"><ShareBtn title={x.name} text={`${x.name} - All Stars FC`} url={shareLink(`#/player/${x.id}`)} /></div></div></Link>)}</div>
      : <Empty>Nobody has registered yet. <Link to="/register">Be the first</Link>.</Empty>}</div>
}

function Excos() {
  const e = useApi('list', { t: 'execos' })
  return <div className="wrap"><h1>Executive Committee</h1>
    {e?.length ? <div className="cards">{e.map(x => <article key={x.id} className="card">
      {x.photo ? <img src={img(x.photo)} alt={x.name} /> : <div className="ph">{x.name?.[0]}</div>}
      <div><h3>{x.name}</h3><small>{x.position}</small>{x.bio && <p>{x.bio}</p>}</div></article>)}</div>
      : <Empty>No excos added yet.</Empty>}</div>
}

function Player() {
  const { id } = useParams(); const p = useApi('player', { id })
  if (!p) return <Empty>Loading player…</Empty>
  const parts = p.name.trim().split(/\s+/); const last = parts.length > 1 ? parts.pop() : ''
  const rows = [['Nationality', p.nationality], ['D.O.B', p.dob], ['Position', p.position], ['Alternate position', p.alt_position],
    ['Height', p.height], ['Weight', p.weight], ['Preferred foot', p.foot], ['Shirt number', p.shirt_no],
    ['State of origin', p.state_origin], ['State of residence', p.state_residence], ['Emergency contact', p.emergency_contact], ['Phone', p.phone], ['Contact email', p.contact_email]].filter(r => r[1])
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

const GAL_FILTERS = [['all', 'All'], ['image', 'Photos'], ['video', 'Videos']]

function Gallery() {
  const [n, setN] = useState(0)
  const g = useApi('list', { t: 'gallery' }, {}, n)
  const [filter, setFilter] = useState('all')
  const [detail, setDetail] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [commentLiked, setCommentLiked] = useState({})
  const [busy, run] = useBusyAction()
  const shown = (g || []).filter(x => filter === 'all' || x.type === filter)
  const like = async x => {
    if (busy) return
    setDetail(d => d && d.id === x.id ? { ...d, likes: (+d.likes || 0) + 1 } : d)
    try {
      const r = await run(() => api('engage', { method: 'POST', params: { t: 'gallery', id: x.id, action: 'like' } }), 'Like added.')
      setDetail(d => d && d.id === x.id ? { ...d, ...r } : d)
      setN(v => v + 1)
    } catch {}
  }
  const likeComment = async c => {
    if (commentLiked[c.id] || busy) return
    setCommentLiked(s => ({ ...s, [c.id]: true }))
    setDetail(d => d && d.commentsList ? { ...d, commentsList: d.commentsList.map(x => x.id === c.id ? { ...x, likes: (+x.likes || 0) + 1 } : x) } : d)
    try {
      const r = await run(() => api('engage', { method: 'POST', params: { t: 'gallery', id: detail.id, action: 'comment_like', cid: c.id } }), 'Like added.')
      if (r && r.likes != null) setDetail(d => d && d.commentsList ? { ...d, commentsList: d.commentsList.map(x => x.id === c.id ? { ...x, likes: +r.likes } : x) } : d)
    } catch {
      setCommentLiked(s => ({ ...s, [c.id]: false }))
      setDetail(d => d && d.commentsList ? { ...d, commentsList: d.commentsList.map(x => x.id === c.id ? { ...x, likes: Math.max(0, (+x.likes || 1) - 1) } : x) } : d)
    }
  }
  const openItem = x => {
    setDetail({ ...x, commentsList: null }); setReplyTo(null); setCommentLiked({})
    api('engage', { method: 'POST', params: { t: 'gallery', id: x.id, action: 'view' } })
      .then(r => { setDetail(d => d && d.id === x.id ? { ...d, ...r } : d); setN(v => v + 1) }).catch(() => {})
    api('engage', { params: { t: 'gallery', id: x.id, action: 'comments' } })
      .then(c => setDetail(d => d && d.id === x.id ? { ...d, commentsList: c } : d))
      .catch(() => setDetail(d => d && d.id === x.id ? { ...d, commentsList: [] } : d))
  }
  const addComment = async (e, parentId = null) => {
    e.preventDefault(); const f = e.target; if (busy) return
    try {
      const c = await run(() => api('engage', { method: 'POST', params: { t: 'gallery', id: detail.id, action: 'comment' }, body: { author_name: f.author_name.value, body: f.body.value, parent_id: parentId } }), parentId ? 'Reply posted.' : 'Comment posted.')
      setDetail(d => ({ ...d, commentsList: c, comments: c.length })); setN(v => v + 1)
      f.body.value = ''; setReplyTo(null)
    } catch {}
  }
  const itemComments = detail?.commentsList
  const roots = itemComments ? itemComments.filter(c => !c.parent_id) : []
  const repliesTo = id => itemComments ? itemComments.filter(c => c.parent_id == id) : []
  const commentCard = (c, isReply) => <div key={c.id} className={'comment' + (isReply ? ' reply' : '')}>
    <div className="comment-head"><b>{c.author_name}</b><small>{fmt(c.created_at)}</small></div>
    <p>{c.body}</p>
    <div className="comment-actions">
      <button type="button" className={'icon-btn' + (commentLiked[c.id] ? ' liked' : '')} disabled={busy} onClick={() => likeComment(c)}>{busy && <Spin />}♥ {+c.likes || 0}</button>
      {!isReply && <button type="button" className="icon-btn" disabled={busy} onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>Reply</button>}
    </div>
  </div>
  return <div className="wrap"><h1>Gallery</h1>
    {g?.length > 0 && <div className="filters">
      {GAL_FILTERS.map(([v, l]) => <button key={v} className={'chip' + (filter === v ? ' on' : '')} onClick={() => setFilter(v)}>{l}</button>)}
    </div>}
    {shown.length > 0 ? <div className="gal-grid">
      {shown.map(x => <button type="button" key={x.id} className="gal-card" onClick={() => openItem(x)}>
        <span className="gal-thumb">
          {x.type === 'video'
            ? <><video src={img(x.file)} preload="metadata" muted playsInline /><span className="gal-play">▶</span></>
            : <img src={img(x.file)} alt={x.caption || 'Gallery photo'} loading="lazy" />}
        </span>
        <span className="gal-info">
          <span className="gal-cap">{x.caption || (x.type === 'video' ? 'Video' : 'Photo')}</span>
          <span className="gal-meta">♥ {+x.likes || 0} · 👁 {+x.views || 0}{x.comments != null ? ` · 💬 ${+x.comments}` : ''}</span>
        </span>
      </button>)}
    </div> : <Empty>{g?.length ? 'Nothing matches that filter.' : 'No photos or videos yet.'}</Empty>}
    {detail && <div className="lightbox gal-modal" onClick={() => setDetail(null)}>
      <div className="gal-modal-inner" onClick={e => e.stopPropagation()}>
        <button className="hl-close" onClick={() => setDetail(null)}>×</button>
        {detail.type === 'video'
          ? <video src={img(detail.file)} controls autoPlay className="gal-modal-media" />
          : <img src={img(detail.file)} alt={detail.caption || ''} className="gal-modal-media" />}
        <div className="gal-modal-side">
          {detail.caption && <p className="gal-cap">{detail.caption}</p>}
          <div className="actions-row">
            <StatBar likes={+detail.likes || 0} views={+detail.views || 0} comments={(detail.commentsList?.length ?? (+detail.comments || 0))} busy={busy} onLike={() => like(detail)} />
            <ShareBtn title={detail.caption || 'Gallery'} text={detail.caption || ''} url={shareLink('#/gallery')} />
          </div>
          <h3>Comments</h3>
          <div className="comments">
            {!itemComments ? <Empty>Loading…</Empty>
              : roots.length === 0 ? <Empty>No comments yet.</Empty>
              : roots.map(c => <div key={c.id} className="comment-thread">
                {commentCard(c, false)}
                {repliesTo(c.id).map(r => commentCard(r, true))}
                {replyTo === c.id && <form className="form comment-form reply-form" onSubmit={e => addComment(e, c.id)}>
                  <input name="author_name" placeholder="Your name (optional)" />
                  <textarea name="body" rows="2" placeholder={`Reply to ${c.author_name}...`} required autoFocus />
                  <div className="actions-row"><button className="btn" disabled={busy}>{busy && <Spin />}Reply</button><button type="button" className="icon-btn" disabled={busy} onClick={() => setReplyTo(null)}>Cancel</button></div>
                </form>}
              </div>)}
          </div>
          <form className="form comment-form" onSubmit={e => addComment(e, null)}>
            <input name="author_name" placeholder="Your name (optional)" />
            <textarea name="body" rows="2" placeholder="Add a comment..." required />
            <button className="btn" disabled={busy}>{busy && <Spin />}Post</button>
          </form>
        </div>
      </div>
    </div>}
  </div>
}

function Register({ refresh }) {
  const nav = useNavigate(); const [err, setErr] = useState(''); const [busy, run] = useBusyAction()
  const submit = async e => {
    e.preventDefault(); setErr('')
    try {
      await run(async () => { await api('register', { method: 'POST', body: await formData(e.target, true) }); await refresh() }, 'Profile created. Welcome to the team!')
      nav('/account')
    } catch (x) { setErr(x.message) }
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
      {err && <p className="err">{err}</p>}<button className="btn" disabled={busy}>{busy && <Spin />}{busy ? 'Creating profile…' : 'Create my profile'}</button></form></div>
}

const CATS = ['Match Day', 'Training', 'Social', 'Awards', 'General']

function Login({ refresh }) {
  const nav = useNavigate(); const [err, setErr] = useState(''); const [busy, run] = useBusyAction()
  const submit = async e => {
    e.preventDefault(); setErr('')
    try {
      await run(async () => { await api('player_login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); await refresh() }, 'Logged in successfully.')
      nav('/account')
    } catch (x) { setErr(x.message) }
  }
  return <div className="wrap narrow"><h1>Player login</h1>
    <form className="form" onSubmit={submit}>
      <label>Email<input name="email" type="email" required /></label>
      <label>Password<input name="password" type="password" required /></label>
      {err && <p className="err">{err}</p>}<button className="btn" disabled={busy}>{busy && <Spin />}{busy ? 'Logging in…' : 'Log in'}</button></form>
    <p>Not a member yet? <Link to="/register">Join the team</Link>.</p></div>
}

const MORE = [['nationality', 'Nationality'], ['dob', 'Date of birth', 'date'], ['height', 'Height (e.g. 1.70m)'], ['weight', 'Weight (e.g. 60kg)'],
  ['foot', 'Preferred foot', 'foot'], ['alt_position', 'Alternate position'], ['state_origin', 'State of origin'], ['state_residence', 'State of residence'],
  ['current_club', 'Current club'], ['phone', 'Phone (shown publicly, optional)', 'tel'], ['contact_email', 'Contact email (shown publicly, optional)', 'email'], ['emergency_contact', 'Emergency contact']]

function Account({ me, refresh }) {
  const nav = useNavigate(); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [prev, setPrev] = useState(''); const [busy, run] = useBusyAction()
  if (me === undefined) return null
  if (!me) return <div className="wrap narrow"><Empty>Please <Link to="/login">log in</Link> to edit your profile.</Empty></div>
  const save = async e => {
    e.preventDefault(); setMsg(''); setErr(''); if (busy) return
    const f = e.target
    try {
      await run(async () => {
        await api('player_update', { method: 'POST', body: await formData(f) })
        await refresh(); setPrev(''); ['photo', 'photo2', 'photo3', 'current_password', 'new_password'].forEach(k => f[k].value = '')
      }, 'Profile saved. Your changes are now live.')
      setMsg('Saved. Your changes are now live on your public profile and the Members page.')
    } catch (x) { setErr(x.message) }
  }
  const logout = async () => { if (busy) return; try { await run(async () => { await api('player_logout'); await refresh() }, 'Logged out.'); nav('/') } catch {} }
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
      <div className="actions"><button className="btn" disabled={busy}>{busy && <Spin />}{busy ? 'Saving…' : 'Save changes'}</button><Link to={`/player/${me.id}`}>View my public profile</Link>
        <button type="button" className="link" disabled={busy} onClick={logout}>{busy && <Spin />}{busy ? 'Logging out…' : 'Log out'}</button></div>
    </form></div>
}

const Glance = ({ col }) => <div className={'glance' + (col ? ' col' : '')}>{GLANCE.map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>

function Club() {
  const [tab, setTab] = useState('about'); const [rule, setRule] = useState(0); const logo = useLogo()
  return <>
    <section className="club-hero">
      <img src={logo} alt="" />
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
  highlights: ['Highlight of the week/month', [['title', 'Title'], ['subtitle', 'Subtitle'], ['body', 'Text'], ['category', 'Category (week/month)'], ['active', 'Active', 'check'], ['sort_order', 'Order', 'number'], ['file', 'Image', 'file']]],
  execos: ['Excos', [['name', 'Name'], ['position', 'Position'], ['bio', 'Bio', 'textarea'], ['sort_order', 'Order', 'number'], ['file', 'Photo', 'file']]],
  news: ['News', [['title', 'Title'], ['body', 'Story', 'textarea']]],
  potm: ['Player of month', [['month', 'Month', 'month'], ['player_id', 'Player', 'player'], ['note', 'Why they won'], ['file', 'Custom photo (optional)', 'file']]],
  matches: ['Matches', [['opponent', 'Opponent'], ['file', 'Opponent logo (optional)', 'file'], ['match_date', 'Date', 'date'], ['venue', 'Venue'], ['home_score', 'All Stars goals', 'number'], ['away_score', 'Opponent goals', 'number'], ['played', 'Played', 'check']]],
  goals: ['Goals', [['player_id', 'Scorer', 'player'], ['match_id', 'Match', 'match'], ['qty', 'Goals', 'number']]],
  gallery: ['Gallery', [['caption', 'Caption'], ['category', 'Category', 'category'], ['file', 'Photo or video', 'file']]],
  players: ['Players', []],
}

function Section({ t }) {
  const [label, fields] = SECTIONS[t]; const [n, setN] = useState(0); const [err, setErr] = useState(''); const [busy, run] = useBusyAction()
  const rows = useApi(t === 'players' ? 'admin_players' : 'list', { t }, n); const players = useApi('list', { t: 'players' })
    const ms = useApi('list', { t: 'matches' }, n)
  const changed = () => { setN(x => x + 1); notifyDataChanged() }
  const result = async r => {
    const a = prompt(`All Stars goals vs ${r.opponent}?`, r.home_score ?? 0); if (a === null) return
    const b = prompt(`${r.opponent} goals?`, r.away_score ?? 0); if (b === null) return
    try { await run(() => api('admin', { method: 'POST', params: { t }, body: { id: r.id, home_score: a, away_score: b } }), 'Result saved.'); changed() } catch {}
  }
  const add = async e => { e.preventDefault(); setErr(''); if (busy) return
    try {
      const b = await formData(e.target)
      await run(() => api('admin', { method: 'POST', params: { t }, body: b }), 'Added successfully.')
      e.target.reset(); changed()
    } catch (x) { setErr(x.message) } }
  const editExco = async r => {
    if (t !== 'execos' || busy) return
    const name = prompt('Name', r.name || '') ?? r.name
    const position = prompt('Position', r.position || '') ?? r.position
    const bio = prompt('Bio', r.bio || '') ?? r.bio
    const sort_order = prompt('Order', r.sort_order ?? 0) ?? r.sort_order
    try { await run(() => api('admin', { method: 'POST', params: { t }, body: { id: r.id, name, position, bio, sort_order, update: 1 } }), 'Changes saved.'); changed() } catch {}
  }
  const uploadPhoto = async r => {
    const url = await uploadToCloud(r.file)
    await api('admin', { method: 'POST', params: { t }, body: { id: r.id, file: url, update: 1 } })
  }
  const pickPhoto = async (row, success) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      try { await run(() => uploadPhoto({ ...row, file }), success); changed() } catch {}
    }
    input.click()
  }
  const editExcoPhoto = r => { if (t === 'execos' && !busy) pickPhoto(r, 'Photo updated.') }
  const editMatch = async r => {
    if (t !== 'matches' || busy) return
    const opponent = prompt('Opponent', r.opponent || '') ?? r.opponent
    const match_date = prompt('Date (YYYY-MM-DD)', r.match_date || '') ?? r.match_date
    const venue = prompt('Venue', r.venue || '') ?? r.venue
    const home_score = prompt('All Stars goals (leave blank if not played)', r.home_score ?? '') ?? r.home_score
    const away_score = prompt('Opponent goals (leave blank if not played)', r.away_score ?? '') ?? r.away_score
    const played = confirm('Mark as played? OK = Yes, Cancel = No')
    try { await run(() => api('admin', { method: 'POST', params: { t }, body: { id: r.id, opponent, match_date, venue, home_score, away_score, played: played ? 1 : 0, update: 1 } }), 'Match updated.'); changed() } catch {}
  }
  const editMatchLogo = r => { if (t === 'matches' && !busy) pickPhoto(r, 'Opponent logo updated.') }
  const del = async id => { if (confirm('Delete this?') && !busy) { try { await run(() => api('admin', { method: 'DELETE', params: { t, id } }), 'Deleted.'); changed() } catch {} } }
  const certify = async r => { if (busy) return; try { await run(() => api('admin', { method: 'POST', params: { t }, body: { id: r.id, certify: r.certified_on ? 0 : 1 } }), r.certified_on ? 'Certification revoked.' : 'Member certified.'); changed() } catch {} }
  const multi = t === 'hero_images'
     const input = ([k, l, ty]) => <label key={k}>{l}{ty === 'textarea' ? <textarea name={k} rows="4" />
    : ty === 'player' ? <select name={k} required>{players?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
    : ty === 'match' ? <select name={k}><option value="">No specific match</option>{ms?.map(x => <option key={x.id} value={x.id}>{x.opponent} · {fmt(x.match_date)}</option>)}</select>
    : ty === 'category' ? <select name={k}>{(t === 'highlights' ? ['week','month'] : CATS).map(c => <option key={c}>{c}</option>)}</select>
    : ty === 'check' ? <input name={k} type="checkbox" value="1" defaultChecked={k === 'active'} />
    : ty === 'file' ? <input name={multi ? 'file[]' : 'file'} type="file" multiple={multi} required={t !== 'matches' && t !== 'potm'} accept={t === 'gallery' ? 'image/*,video/mp4,video/webm' : 'image/*'} />
    : <input name={k} type={ty || 'text'} required={['title', 'opponent', 'match_date', 'month'].includes(k) && t !== 'highlights' && t !== 'potm' ? true : (['name','position'].includes(k))} />}</label>
  return (<div><h2>{label}</h2>
    {fields.length > 0 && <form className="form" onSubmit={add}>{fields.map(input)}{err && <p className="err">{err}</p>}<button className="btn" disabled={busy}>{busy && <Spin />}{busy ? (multi ? 'Uploading…' : 'Adding…') : (multi ? 'Upload' : 'Add')}</button></form>}
        <ul className="rows">{rows?.map(r => <li key={r.id}>
      <span>{(r.image||r.photo||r.opponent_logo) && <img className="thumb" src={img(r.image||r.photo||r.opponent_logo)} alt="" />}{[r.title, r.opponent, r.name, r.position, r.month, r.caption, r.qty && `x${r.qty}`].filter(Boolean).join(' · ') || `#${r.id}`}
        {r.certified_on && <em className="since"> ✓ certified {fmt(r.certified_on)}</em>}</span>
        {r.introduced_by && <em className="since"> · introduced by {r.introduced_by}</em>}
        <span className="btns">
        {t === 'matches' && <button className="ok-btn" disabled={busy} onClick={() => result(r)}>{busy && <Spin />}{+r.played ? 'Edit result' : 'Set result'}</button>}
        {t === 'matches' && <button disabled={busy} onClick={() => editMatch(r)}>{busy && <Spin />}Edit</button>}
        {t === 'matches' && <button disabled={busy} onClick={() => editMatchLogo(r)}>{busy && <Spin />}Change opponent logo</button>}
        {t === 'players' && <button className={'cert' + (r.certified_on ? ' on' : '')} disabled={busy} onClick={() => certify(r)}>{busy && <Spin />}{r.certified_on ? 'Revoke' : 'Certify'}</button>}
        {t === 'execos' && <button disabled={busy} onClick={() => editExco(r)}>{busy && <Spin />}Edit</button>}
        {t === 'execos' && <button disabled={busy} onClick={() => editExcoPhoto(r)}>{busy && <Spin />}Change photo</button>}
        <button disabled={busy} onClick={() => del(r.id)}>{busy && <Spin />}Delete</button></span>
        </li>)}
        </ul>
        </div>)
}

function HeroMode() {
  const [mode, setMode] = useState(null)
  const [busy, run] = useBusyAction()
  useEffect(() => { api('hero_mode').then(d => setMode(d.mode)) }, [])
  const set = async m => {
    if (busy || m === mode) return
    const old = mode; setMode(m)
    try { await run(() => api('hero_mode', { method: 'POST', body: { mode: m } }), 'Hero style updated.') } catch { setMode(old) }
  }
  if (!mode) return null
  return <fieldset className="mode"><legend>Hero style</legend>
    {[['scroll', 'Scrollable slideshow (all hero images)'], ['static', 'Static (first image only)']].map(([v, l]) =>
      <label key={v}><input type="radio" name="mode" checked={mode === v} disabled={busy} onChange={() => set(v)} />{busy && <Spin />}{l}</label>)}
    <small>In static mode the image with the lowest Order number is shown.</small></fieldset>
}

function ClubLogo() {
  const [logo, setLogo] = useState(null)
  const [busy, run] = useBusyAction()
  useEffect(() => { api('branding').then(d => setLogo(d.club_logo || '')).catch(() => setLogo('')) }, [])
  const pick = () => {
    if (busy) return
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return
      try {
        await run(async () => {
          const url = await uploadToCloud(f)
          await api('branding', { method: 'POST', body: { club_logo: url } })
          setLogo(url); window.dispatchEvent(new Event('club-logo-changed'))
        }, 'Club logo updated.')
      } catch {}
    }
    input.click()
  }
  const reset = async () => {
    if (!confirm('Reset to the default club logo?') || busy) return
    try {
      await run(async () => { await api('branding', { method: 'POST', body: { club_logo: '' } }); setLogo(''); window.dispatchEvent(new Event('club-logo-changed')) }, 'Club logo reset to default.')
    } catch {}
  }
  if (logo === null) return null
  return <fieldset className="mode"><legend>Club logo</legend>
    <div className="logo-admin">
      <img src={logo ? img(logo) : DEFAULT_LOGO} alt="Club logo" />
      <div className="actions-row">
        <button type="button" className="btn" disabled={busy} onClick={pick}>{busy && <Spin />}{busy ? 'Uploading…' : 'Change logo'}</button>
        {logo && <button type="button" className="icon-btn" disabled={busy} onClick={reset}>{busy && <Spin />}Reset to default</button>}
      </div>
    </div>
    <small>Shown in the header, news banners, club page and next to All Stars FC on the matches page.</small>
  </fieldset>
}

function Admin() {
  const [auth, setAuth] = useState(null); const [err, setErr] = useState(''); const [tab, setTab] = useState('hero_images'); const [busy, run] = useBusyAction()
  useEffect(() => { api('me').then(d => setAuth(d.admin)) }, [])
  const login = async e => {
    e.preventDefault(); setErr('')
    try { await run(() => api('login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }), 'Logged in successfully.'); setAuth(true) } catch (x) { setErr(x.message) }
  }
  const logout = async () => {
    if (busy) return
    try { await run(() => api('logout'), 'Logged out.'); setAuth(false) } catch {}
  }
  if (auth === null) return null
  if (!auth) return <div className="wrap narrow"><h1>Admin login</h1><form className="form" onSubmit={login}>
    <label>Username<input name="username" required /></label><label>Password<input name="password" type="password" required /></label>
    {err && <p className="err">{err}</p>}<button className="btn" disabled={busy}>{busy && <Spin />}{busy ? 'Logging in…' : 'Log in'}</button></form></div>
  return <div className="wrap"><h1>Admin</h1>
    <div className="tabs">{Object.entries(SECTIONS).map(([k, [l]]) => <button key={k} className={tab === k ? 'on' : ''} disabled={busy} onClick={() => setTab(k)}>{l}</button>)}
      <button disabled={busy} onClick={logout}>{busy && <Spin />}Log out</button></div>
        {tab === 'hero_images' && <HeroMode />}{tab === 'matches' && <ClubLogo />}<Section key={tab} t={tab} /></div>
}
