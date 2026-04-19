import React from 'react';
import { Session, SessionFilters } from '../types';

interface Props {
  filters: SessionFilters;
  sessions: Session[];
  onFilterChange: (patch: Partial<SessionFilters>) => void;
}

const TYPES      = ['Keynote', 'Breakout', 'Lab', 'Demo', 'Lightning Talk'];
const TYPE_COLORS: Record<string, string> = {
  Keynote:        '#a78bfa',
  Breakout:       '#60a5fa',
  Lab:            '#fbbf24',
  Demo:           '#4ade80',
  'Lightning Talk':'#fb7185',
};

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`filter-btn${active ? ' active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function FilterSidebar({ filters, sessions, onFilterChange }: Props) {
  const counts = React.useMemo(() => ({
    all:      sessions.length,
    must:     sessions.filter(s => s.prio === 'must').length,
    high:     sessions.filter(s => s.prio === 'high').length,
    good:     sessions.filter(s => s.prio === 'good').length,
    skip:     sessions.filter(s => s.prio === 'skip').length,
    types:    Object.fromEntries(
                TYPES.map(t => [t, sessions.filter(s => s.type === t).length])
              ),
  }), [sessions]);

  // Unique categories from loaded sessions
  const categories = React.useMemo(() => {
    const cats = Array.from(new Set(sessions.map(s => s.category).filter(Boolean))) as string[];
    return cats.sort();
  }, [sessions]);

  return (
    <aside className="sidebar">
      {/* Priority */}
      <div className="sidebar-section">
        <div className="sidebar-title">Priority</div>
        {[
          { val: 'all',  label: 'All sessions', dotStyle: { background: '#8892a4' },                                         cnt: counts.all  },
          { val: 'must', label: 'Must-attend',  dotStyle: { background: 'var(--must)', boxShadow: '0 0 6px rgba(59,130,246,0.5)' }, cnt: counts.must },
          { val: 'high', label: 'High priority',dotStyle: { background: 'var(--high)' },                                     cnt: counts.high },
          { val: 'good', label: 'Good if time', dotStyle: { background: 'var(--good)' },                                     cnt: counts.good },
          { val: 'skip', label: 'Skip',         dotStyle: { background: 'var(--skip)' },                                     cnt: counts.skip },
        ].map(({ val, label, dotStyle, cnt }) => (
          <FilterBtn
            key={val}
            active={filters.prio === val}
            onClick={() => onFilterChange({ prio: val })}
          >
            <span className="dot" style={dotStyle} />
            {label}
            <span className="count">{cnt}</span>
          </FilterBtn>
        ))}
      </div>

      {/* Session type */}
      <div className="sidebar-section">
        <div className="sidebar-title">Session type</div>
        <FilterBtn active={filters.type === 'all'} onClick={() => onFilterChange({ type: 'all' })}>
          <span className="type-tag" style={{ background: '#a78bfa' }} />
          All types <span className="count">{counts.all}</span>
        </FilterBtn>
        {TYPES.map(type => (
          <FilterBtn
            key={type}
            active={filters.type === type}
            onClick={() => onFilterChange({ type })}
          >
            <span className="type-tag" style={{ background: TYPE_COLORS[type] }} />
            {type === 'Lightning Talk' ? 'Lightning' : type}
            <span className="count">{counts.types[type] ?? 0}</span>
          </FilterBtn>
        ))}
      </div>

      {/* Category / Track */}
      <div className="sidebar-section">
        <div className="sidebar-title">Track</div>
        <FilterBtn active={filters.category === 'all'} onClick={() => onFilterChange({ category: 'all' })}>
          All tracks
        </FilterBtn>
        {categories.map(cat => (
          <FilterBtn
            key={cat}
            active={filters.category === cat}
            onClick={() => onFilterChange({ category: cat })}
          >
            {cat}
          </FilterBtn>
        ))}
      </div>

      {/* Recorded */}
      <div className="sidebar-section">
        <div className="sidebar-title">Recorded</div>
        <FilterBtn active={filters.recorded === 'all'} onClick={() => onFilterChange({ recorded: 'all' })}>All</FilterBtn>
        <FilterBtn active={filters.recorded === 'yes'} onClick={() => onFilterChange({ recorded: 'yes' })}>✓ Recorded</FilterBtn>
        <FilterBtn active={filters.recorded === 'no'}  onClick={() => onFilterChange({ recorded: 'no'  })}>★ Must attend in-person</FilterBtn>
      </div>
    </aside>
  );
}