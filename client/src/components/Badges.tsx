import React from 'react';
import { Session, Prio } from '../types';

// ── TYPE BADGE ─────────────────────────────────────────────────────────────────
const TYPE_BADGE_KEY = (t: string) => t.replace(/\s+/g, '');

export function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const short = type === 'Lightning Talk' ? 'Lightning' : type;
  return <span className={`type-badge tb-${TYPE_BADGE_KEY(type)}`}>{short}</span>;
}

// ── PRIO BADGE ─────────────────────────────────────────────────────────────────
export const PRIO_LABELS: Record<Prio, string> = {
  must: 'Must-attend',
  high: 'High priority',
  good: 'Good if time',
  skip: 'Skip',
};

export function PrioBadge({ prio }: { prio: Prio }) {
  return (
    <span className={`prio-badge pb-${prio}`}>
      <span className="prio-dot" />
      {PRIO_LABELS[prio]}
    </span>
  );
}

// ── REC BADGE ──────────────────────────────────────────────────────────────────
export function RecBadge({ session }: { session: Session }) {
  if (session.type === 'Lab')     return <span className="rec-inperson">★ In-person</span>;
  if (session.is_recorded)        return <span className="rec-yes">✓ Yes</span>;
  return                                 <span className="rec-no">✗ No</span>;
}