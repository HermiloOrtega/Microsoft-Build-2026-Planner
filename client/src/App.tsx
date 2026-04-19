import { useState, useEffect, useMemo, useCallback } from 'react';
import { Session, SessionFilters } from './types';
import { fetchSessions } from './api/sessions';
import FilterSidebar from './components/FilterSidebar';
import SessionTable from './components/SessionTable';
import SessionModal from './components/SessionModal';
import SyncButton from './components/SyncButton';
import PasteImportButton from './components/PasteImportButton';
import { PrioBadge } from './components/Badges';

const PRIO_ORDER: Record<string, number> = { must: 0, high: 1, good: 2, skip: 3 };

const DEFAULT_FILTERS: SessionFilters = {
  prio:      'all',
  type:      'all',
  category:  'all',
  recorded:  'all',
  search:    '',
  sort:      'prio',
  direction: 'asc',
};

export default function App() {
  const [allSessions,    setAllSessions]    = useState<Session[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [filters,        setFilters]        = useState<SessionFilters>(DEFAULT_FILTERS);
  const [selectedSession,setSelectedSession] = useState<Session | null>(null);
  const [view,           setView]           = useState<'table' | 'cards'>('table');
  const [sidebarOpen,    setSidebarOpen]    = useState(true);

  // ── Fetch all sessions from server ──────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSessions();
      setAllSessions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ── Filter + sort client-side (fast, avoids round-trips on every keystroke) ─
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();

    return allSessions.filter(s => {
      if (filters.prio     !== 'all' && s.prio     !== filters.prio)     return false;
      if (filters.type     !== 'all' && s.type     !== filters.type)     return false;
      if (filters.category !== 'all' && s.category !== filters.category) return false;
      if (filters.recorded === 'yes' && (!s.is_recorded || s.type === 'Lab')) return false;
      if (filters.recorded === 'no'  && s.is_recorded && s.type !== 'Lab')    return false;
      if (q) {
        return (
          s.code.toLowerCase().includes(q)         ||
          s.title.toLowerCase().includes(q)        ||
          (s.category ?? '').toLowerCase().includes(q) ||
          (s.type     ?? '').toLowerCase().includes(q) ||
          (s.why      ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    }).sort((a, b) => {
      const dir = filters.direction === 'desc' ? -1 : 1;
      let va: any, vb: any;

      switch (filters.sort) {
        case 'prio':     va = PRIO_ORDER[a.prio] ?? 99; vb = PRIO_ORDER[b.prio] ?? 99; break;
        case 'level':    va = a.level ?? 0;              vb = b.level ?? 0;             break;
        default:         va = String((a as any)[filters.sort] ?? '').toLowerCase();
                         vb = String((b as any)[filters.sort] ?? '').toLowerCase();
      }

      if (va < vb) return -dir;
      if (va > vb) return  dir;
      return a.code.localeCompare(b.code);
    });
  }, [allSessions, filters]);

  // ── Filter helpers ───────────────────────────────────────────────────────────
  function updateFilters(patch: Partial<SessionFilters>) {
    setFilters(f => ({ ...f, ...patch }));
  }

  function handleSort(col: string) {
    setFilters(f => ({
      ...f,
      sort:      col,
      direction: f.sort === col && f.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  const isFiltered =
    filters.prio     !== 'all' ||
    filters.type     !== 'all' ||
    filters.category !== 'all' ||
    filters.recorded !== 'all' ||
    filters.search   !== '';

  // ── Modal callbacks ──────────────────────────────────────────────────────────
  function handleSaved(updated: Session) {
    setAllSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelectedSession(updated);
  }

  function handleDeleted(id: number) {
    setAllSessions(prev => prev.filter(s => s.id !== id));
    setSelectedSession(null);
  }

  // ── Metrics ──────────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    total: allSessions.length,
    must:  allSessions.filter(s => s.prio === 'must').length,
    high:  allSessions.filter(s => s.prio === 'high').length,
    good:  allSessions.filter(s => s.prio === 'good').length,
    labs:  allSessions.filter(s => s.type === 'Lab').length,
  }), [allSessions]);

  return (
    <>
      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-top">
          <div>
            <div className="header-eyebrow">Microsoft Build 2026 · San Francisco</div>
            <h1>Session <span>Planner</span></h1>
            <p className="header-sub">
              {allSessions.length} sessions · Software Engineering Manager · Microsoft Stack · Quattro Constructors / RAM
            </p>
          </div>
          <div className="metrics">
            <div className="metric">
              <div className="metric-val c-total">{counts.total}</div>
              <div className="metric-label">Total</div>
            </div>
            <div className="metric">
              <div className="metric-val c-must">{counts.must}</div>
              <div className="metric-label">Must-attend</div>
            </div>
            <div className="metric">
              <div className="metric-val c-high">{counts.high}</div>
              <div className="metric-label">High priority</div>
            </div>
            <div className="metric">
              <div className="metric-val c-good">{counts.good}</div>
              <div className="metric-label">Good if time</div>
            </div>
            <div className="metric">
              <div className="metric-val c-lab">{counts.labs}</div>
              <div className="metric-label">In-person labs</div>
            </div>
          </div>
        </div>
      </header>

      <div className="main">
        {/* ── SIDEBAR ── */}
        <div className={`sidebar-wrapper${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
          <button
            className="sidebar-toggle"
            title={sidebarOpen ? 'Hide filters' : 'Show filters'}
            onClick={() => setSidebarOpen(o => !o)}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
          {sidebarOpen && (
            <FilterSidebar
              filters={filters}
              sessions={allSessions}
              onFilterChange={updateFilters}
            />
          )}
        </div>

        {/* ── TABLE AREA ── */}
        <div className="table-area">

          {/* SEARCH / CONTROLS */}
          <div className="search-wrap">
            <div className="search-inner">
              <input
                className="search-box"
                type="text"
                placeholder="Search sessions, tracks, IDs…"
                value={filters.search}
                onChange={e => updateFilters({ search: e.target.value })}
              />
              <select
                className="sort-select"
                value={filters.sort}
                onChange={e => updateFilters({ sort: e.target.value, direction: 'asc' })}
              >
                <option value="prio">Sort: Priority</option>
                <option value="code">Sort: Session Code</option>
                <option value="title">Sort: Title A–Z</option>
                <option value="level">Sort: Level</option>
                <option value="type">Sort: Type</option>
                <option value="category">Sort: Track</option>
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
              <span className="result-count">
                {loading ? 'Loading…' : `${filtered.length} of ${allSessions.length} sessions`}
              </span>
              <SyncButton onSyncComplete={loadSessions} />
              <PasteImportButton onImportComplete={loadSessions} />
            </div>
          </div>

          {/* LEGEND */}
          <div className="legend">
            <span className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--must)', boxShadow: '0 0 5px rgba(59,130,246,0.5)' }} />
              Must-attend
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--high)' }} />
              High priority
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--good)' }} />
              Good if time
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--skip)' }} />
              Skip
            </span>
            <span style={{ marginLeft: 8 }}>★ = in-person only, not recorded — schedule these first</span>
          </div>

          {/* CONTENT */}
          {error ? (
            <div className="empty">
              <h3>Failed to load sessions</h3>
              <p>{error}</p>
              <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={loadSessions}>
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="empty">
              <h3>Loading sessions…</h3>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <h3>No sessions match</h3>
              <p>Try adjusting your filters or search query.</p>
            </div>
          ) : view === 'table' ? (
            <SessionTable
              sessions={filtered}
              sortCol={filters.sort}
              sortDir={filters.direction}
              onSort={handleSort}
              onRowClick={s => setSelectedSession(s)}
            />
          ) : (
            <div className="card-grid">
              {filtered.map(s => (
                <div
                  key={s.id}
                  className={`session-card row-${s.prio}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedSession(s)}
                >
                  <div className="card-header">
                    <span className="card-id">{s.code}</span>
                    <PrioBadge prio={s.prio} />
                  </div>
                  <div className="card-title">{s.title}</div>
                  <div className="card-meta">
                    {s.type && (
                      <span className={`type-badge tb-${s.type.replace(/\s+/g, '')}`}>
                        {s.type === 'Lightning Talk' ? 'Lightning' : s.type}
                      </span>
                    )}
                    {s.category && <span className="card-track">{s.category}</span>}
                    {s.level != null && s.level > 0 && <span className="card-lvl">L{s.level}</span>}
                  </div>
                  {s.why && <div className="card-why">{s.why}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL ── */}
      {selectedSession && (
        <SessionModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}