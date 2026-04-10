import { useState, useMemo } from 'react'
import { SESSIONS, TRACKS, TYPES, PRIO_ORDER } from './data/sessions'

/* ── helpers ── */
const TYPE_BADGE_KEY = (t) => t.replace(/\s+/g, '')

const PRIO_LABELS = { must: 'Must-attend', high: 'High priority', good: 'Good if time', skip: 'Skip' }

function TypeBadge({ type }) {
  const short = type === 'Lightning Talk' ? 'Lightning' : type
  return <span className={`type-badge tb-${TYPE_BADGE_KEY(type)}`}>{short}</span>
}

function PrioBadge({ prio }) {
  return (
    <span className={`prio-badge pb-${prio}`}>
      <span className="prio-dot" />
      {PRIO_LABELS[prio]}
    </span>
  )
}

function RecBadge({ session }) {
  if (session.type === 'Lab') return <span className="rec-inperson">★ In-person</span>
  if (session.rec)            return <span className="rec-yes">✓ Yes</span>
  return                             <span className="rec-no">✗ No</span>
}

/* ── sidebar filter button ── */
function FilterBtn({ active, onClick, children }) {
  return (
    <button className={`filter-btn${active ? ' active' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

/* ── table view ── */
function TableView({ sessions, sortCol, sortDir, onSort }) {
  const indicator = (col) => sortCol === col ? (sortDir === 1 ? ' ↑' : ' ↓') : ' ↕'

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {[
              { col: 'id',    label: 'ID' },
              { col: 'title', label: 'Title' },
              { col: 'type',  label: 'Type' },
              { col: 'track', label: 'Track' },
              { col: 'lvl',   label: 'Lvl' },
              { col: 'prio',  label: 'Priority' },
              { col: 'rec',   label: 'Recorded' },
            ].map(({ col, label }) => (
              <th
                key={col}
                className={sortCol === col ? 'sort-active' : ''}
                onClick={() => onSort(col)}
              >
                {label}{indicator(col)}
              </th>
            ))}
            <th>Why it matters</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className={`row-${s.prio}`}>
              <td className="td-id">{s.id}</td>
              <td className="td-title">{s.title}</td>
              <td className="td-type"><TypeBadge type={s.type} /></td>
              <td className="td-track">{s.track}</td>
              <td className="td-lvl">{s.lvl || '—'}</td>
              <td className="td-prio"><PrioBadge prio={s.prio} /></td>
              <td className="td-rec"><RecBadge session={s} /></td>
              <td className="td-why">{s.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── card view ── */
function CardView({ sessions }) {
  return (
    <div className="card-grid">
      {sessions.map((s) => (
        <div key={s.id} className={`session-card row-${s.prio}`}>
          <div className="card-header">
            <span className="card-id">{s.id}</span>
            <PrioBadge prio={s.prio} />
          </div>
          <div className="card-title">{s.title}</div>
          <div className="card-meta">
            <TypeBadge type={s.type} />
            <span className="card-track">{s.track}</span>
            {s.lvl > 0 && <span className="card-lvl">L{s.lvl}</span>}
            <RecBadge session={s} />
          </div>
          <div className="card-why">{s.why}</div>
        </div>
      ))}
    </div>
  )
}

/* ── main app ── */
export default function App() {
  const [activePrio,  setActivePrio]  = useState('all')
  const [activeType,  setActiveType]  = useState('all')
  const [activeTrack, setActiveTrack] = useState('all')
  const [activeRec,   setActiveRec]   = useState('all')
  const [search,      setSearch]      = useState('')
  const [sortCol,     setSortCol]     = useState('prio')
  const [sortDir,     setSortDir]     = useState(1)
  const [view,        setView]        = useState('table') // 'table' | 'cards'

  /* ── counts for sidebar badges ── */
  const counts = useMemo(() => ({
    all:  SESSIONS.length,
    must: SESSIONS.filter(s => s.prio === 'must').length,
    high: SESSIONS.filter(s => s.prio === 'high').length,
    good: SESSIONS.filter(s => s.prio === 'good').length,
    skip: SESSIONS.filter(s => s.prio === 'skip').length,
    types: Object.fromEntries(TYPES.map(t => [t, SESSIONS.filter(s => s.type === t).length])),
  }), [])

  /* ── filtered + sorted sessions ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return SESSIONS.filter(s => {
      if (activePrio  !== 'all' && s.prio  !== activePrio)  return false
      if (activeType  !== 'all' && s.type  !== activeType)  return false
      if (activeTrack !== 'all' && s.track !== activeTrack) return false
      if (activeRec   === 'yes' && (!s.rec || s.type === 'Lab')) return false
      if (activeRec   === 'no'  && s.rec && s.type !== 'Lab')    return false
      if (q) {
        return (
          s.id.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q) ||
          s.track.toLowerCase().includes(q) ||
          s.type.toLowerCase().includes(q) ||
          s.why.toLowerCase().includes(q)
        )
      }
      return true
    }).sort((a, b) => {
      let va, vb
      if (sortCol === 'prio')     { va = PRIO_ORDER[a.prio]; vb = PRIO_ORDER[b.prio] }
      else if (sortCol === 'lvl') { va = a.lvl || 0;         vb = b.lvl || 0 }
      else                        { va = String(a[sortCol] || '').toLowerCase(); vb = String(b[sortCol] || '').toLowerCase() }
      if (va < vb) return -sortDir
      if (va > vb) return  sortDir
      return 0
    })
  }, [activePrio, activeType, activeTrack, activeRec, search, sortCol, sortDir])

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(1) }
  }

  function clearFilters() {
    setActivePrio('all')
    setActiveType('all')
    setActiveTrack('all')
    setActiveRec('all')
    setSearch('')
  }

  const isFiltered = activePrio !== 'all' || activeType !== 'all' || activeTrack !== 'all' || activeRec !== 'all' || search !== ''

  /* ── metrics ── */
  const labs = SESSIONS.filter(s => s.type === 'Lab').length

  return (
    <>
      {/* HEADER */}
      <header className="header">
        <div className="header-top">
          <div>
            <div className="header-eyebrow">Microsoft Build 2026 · San Francisco</div>
            <h1>Session <span>Planner</span></h1>
            <p className="header-sub">
              {SESSIONS.length} sessions curated for Software Engineering Manager · Microsoft Stack · Quattro Constructors / RAM
            </p>
          </div>
          <div className="metrics">
            <div className="metric"><div className="metric-val c-total">{SESSIONS.length}</div><div className="metric-label">Total</div></div>
            <div className="metric"><div className="metric-val c-must">{counts.must}</div><div className="metric-label">Must-attend</div></div>
            <div className="metric"><div className="metric-val c-high">{counts.high}</div><div className="metric-label">High priority</div></div>
            <div className="metric"><div className="metric-val c-good">{counts.good}</div><div className="metric-label">Good if time</div></div>
            <div className="metric"><div className="metric-val c-lab">{labs}</div><div className="metric-label">In-person labs</div></div>
          </div>
        </div>
      </header>

      <div className="main">
        {/* SIDEBAR */}
        <aside className="sidebar">
          {/* Priority */}
          <div className="sidebar-section">
            <div className="sidebar-title">Priority</div>
            {[
              { val: 'all',  label: 'All sessions', dotStyle: { background: '#8892a4' },                           cnt: counts.all  },
              { val: 'must', label: 'Must-attend',  dotStyle: { background: 'var(--must)', boxShadow: '0 0 6px rgba(59,130,246,0.5)' }, cnt: counts.must },
              { val: 'high', label: 'High priority',dotStyle: { background: 'var(--high)' },                       cnt: counts.high },
              { val: 'good', label: 'Good if time', dotStyle: { background: 'var(--good)' },                       cnt: counts.good },
              { val: 'skip', label: 'Skip',         dotStyle: { background: 'var(--skip)' },                       cnt: counts.skip },
            ].map(({ val, label, dotStyle, cnt }) => (
              <FilterBtn key={val} active={activePrio === val} onClick={() => setActivePrio(val)}>
                <span className="dot" style={dotStyle} />
                {label}
                <span className="count">{cnt}</span>
              </FilterBtn>
            ))}
          </div>

          {/* Session type */}
          <div className="sidebar-section">
            <div className="sidebar-title">Session type</div>
            <FilterBtn active={activeType === 'all'} onClick={() => setActiveType('all')}>
              <span className="type-tag" style={{ background: '#a78bfa' }} />
              All types <span className="count">{counts.all}</span>
            </FilterBtn>
            {[
              { type: 'Keynote',       color: '#a78bfa', key: 'Keynote' },
              { type: 'Breakout',      color: '#60a5fa', key: 'Breakout' },
              { type: 'Lab',           color: '#fbbf24', key: 'Lab' },
              { type: 'Demo',          color: '#4ade80', key: 'Demo' },
              { type: 'Lightning Talk',color: '#fb7185', key: 'Lightning Talk' },
            ].map(({ type, color, key }) => (
              <FilterBtn key={key} active={activeType === type} onClick={() => setActiveType(type)}>
                <span className="type-tag" style={{ background: color }} />
                {type === 'Lightning Talk' ? 'Lightning' : type}
                <span className="count">{counts.types[type]}</span>
              </FilterBtn>
            ))}
          </div>

          {/* Track */}
          <div className="sidebar-section">
            <div className="sidebar-title">Track</div>
            <FilterBtn active={activeTrack === 'all'} onClick={() => setActiveTrack('all')}>
              All tracks
            </FilterBtn>
            {TRACKS.map(t => (
              <FilterBtn key={t} active={activeTrack === t} onClick={() => setActiveTrack(t)}>
                {t}
              </FilterBtn>
            ))}
          </div>

          {/* Recorded */}
          <div className="sidebar-section">
            <div className="sidebar-title">Recorded</div>
            <FilterBtn active={activeRec === 'all'} onClick={() => setActiveRec('all')}>All</FilterBtn>
            <FilterBtn active={activeRec === 'yes'} onClick={() => setActiveRec('yes')}>✓ Recorded</FilterBtn>
            <FilterBtn active={activeRec === 'no'}  onClick={() => setActiveRec('no')}>★ Must attend in-person</FilterBtn>
          </div>
        </aside>

        {/* TABLE AREA */}
        <div className="table-area">

          {/* SEARCH */}
          <div className="search-wrap">
            <div className="search-inner">
              <input
                className="search-box"
                type="text"
                placeholder="Search sessions, tracks, IDs…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                className="sort-select"
                value={sortCol}
                onChange={e => { setSortCol(e.target.value); setSortDir(1) }}
              >
                <option value="prio">Sort: Priority</option>
                <option value="id">Sort: Session ID</option>
                <option value="title">Sort: Title A–Z</option>
                <option value="lvl">Sort: Level</option>
                <option value="type">Sort: Type</option>
                <option value="track">Sort: Track</option>
              </select>
              <div className="view-toggle">
                <button
                  className={`view-btn${view === 'table' ? ' active' : ''}`}
                  title="Table view"
                  onClick={() => setView('table')}
                >
                  ☰
                </button>
                <button
                  className={`view-btn${view === 'cards' ? ' active' : ''}`}
                  title="Card view"
                  onClick={() => setView('cards')}
                >
                  ⊞
                </button>
              </div>
              {isFiltered && (
                <button className="clear-btn" onClick={clearFilters}>Clear filters</button>
              )}
              <span className="result-count">{filtered.length} of {SESSIONS.length} sessions</span>
            </div>
          </div>

          {/* LEGEND */}
          <div className="legend">
            <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--must)', boxShadow: '0 0 5px rgba(59,130,246,0.5)' }} />Must-attend</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--high)' }} />High priority</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--good)' }} />Good if time</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--skip)' }} />Skip</span>
            <span style={{ marginLeft: 8 }}>★ = in-person only, not recorded — schedule these first</span>
          </div>

          {/* RESULTS */}
          {filtered.length === 0 ? (
            <div className="empty">
              <h3>No sessions match</h3>
              <p>Try adjusting your filters or search query.</p>
            </div>
          ) : view === 'table' ? (
            <TableView sessions={filtered} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          ) : (
            <CardView sessions={filtered} />
          )}
        </div>
      </div>
    </>
  )
}
