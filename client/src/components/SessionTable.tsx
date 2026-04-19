import React from 'react';
import { Session, SessionFilters } from '../types';
import { TypeBadge, PrioBadge, RecBadge } from './Badges';

interface Props {
  sessions: Session[];
  sortCol: string;
  sortDir: 'asc' | 'desc';
  onSort: (col: string) => void;
  onRowClick: (session: Session) => void;
}

const COLUMNS = [
  { col: 'code',     label: 'Code'     },
  { col: 'title',    label: 'Title'    },
  { col: 'type',     label: 'Type'     },
  { col: 'category', label: 'Track'    },
  { col: 'level',    label: 'Lvl'      },
  { col: 'prio',     label: 'Priority' },
  { col: 'recorded', label: 'Recorded' },
];

export default function SessionTable({ sessions, sortCol, sortDir, onSort, onRowClick }: Props) {
  const indicator = (col: string) =>
    sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {COLUMNS.map(({ col, label }) => (
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
          {sessions.map(s => (
            <tr
              key={s.id}
              className={`row-${s.prio}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onRowClick(s)}
            >
              <td className="td-id">{s.code}</td>
              <td className="td-title">{s.title}</td>
              <td className="td-type"><TypeBadge type={s.type} /></td>
              <td className="td-track">{s.category}</td>
              <td className="td-lvl">{s.level || '—'}</td>
              <td className="td-prio"><PrioBadge prio={s.prio} /></td>
              <td className="td-rec"><RecBadge session={s} /></td>
              <td className="td-why">{s.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}