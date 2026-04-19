import React, { useState } from 'react';
import { Session, Prio } from '../types';
import { TypeBadge, RecBadge, PRIO_LABELS } from './Badges';
import { updateSession, deleteSession } from '../api/sessions';

interface Props {
  session: Session;
  onClose: () => void;
  onSaved: (updated: Session) => void;
  onDeleted: (id: number) => void;
}

export default function SessionModal({ session, onClose, onSaved, onDeleted }: Props) {
  const [prio,        setPrio]        = useState<Prio>(session.prio);
  const [why,         setWhy]         = useState(session.why ?? '');
  const [isFavorite,  setIsFavorite]  = useState(session.is_favorite);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateSession(session.id, {
        ...session,
        prio,
        why,
        is_favorite: isFavorite,
      });
      onSaved(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete session "${session.code} — ${session.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSession(session.id);
      onDeleted(session.id);
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        {/* ── Header ── */}
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-code">{session.code}</span>
            <TypeBadge type={session.type} />
            <RecBadge session={session} />
          </div>
          <div className="modal-header-right">
            <button
              className={`fav-btn${isFavorite ? ' active' : ''}`}
              onClick={() => setIsFavorite(f => !f)}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? '★' : '☆'}
            </button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── Title ── */}
        <h2 className="modal-title">{session.title}</h2>

        {/* ── Meta row ── */}
        <div className="modal-meta">
          {session.category && <span className="modal-meta-item">{session.category}</span>}
          {session.level ? <span className="modal-meta-item">Level {session.level}</span> : null}
          {session.modality && <span className="modal-meta-item">{session.modality}</span>}
        </div>

        {/* ── Description ── */}
        {session.description && (
          <p className="modal-description">{session.description}</p>
        )}

        {/* ── Session URL ── */}
        {session.session_url && (
          <a
            className="modal-link"
            href={session.session_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on build.microsoft.com →
          </a>
        )}

        {/* ── Speakers ── */}
        {session.speakers && session.speakers.length > 0 && (
          <div className="modal-speakers">
            <div className="modal-section-title">Speakers</div>
            <div className="speakers-list">
              {session.speakers.map(sp => (
                <div key={sp.id} className="speaker-item">
                  {sp.photo_url ? (
                    <img
                      src={sp.photo_url}
                      alt={sp.name}
                      className="speaker-photo"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="speaker-photo-placeholder">{sp.name.charAt(0)}</div>
                  )}
                  <div className="speaker-info">
                    {sp.profile_url ? (
                      <a href={sp.profile_url} target="_blank" rel="noopener noreferrer" className="speaker-name">
                        {sp.name}
                      </a>
                    ) : (
                      <span className="speaker-name">{sp.name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-divider" />

        {/* ── Editable fields ── */}
        <div className="modal-edit-section">
          <div className="modal-section-title">Planning</div>

          {/* Priority */}
          <div className="modal-field">
            <label className="modal-label">Priority</label>
            <select
              className="modal-select"
              value={prio}
              onChange={e => setPrio(e.target.value as Prio)}
            >
              <option value="must">Must-attend</option>
              <option value="high">High priority</option>
              <option value="good">Good if time</option>
              <option value="skip">Skip</option>
            </select>
          </div>

          {/* Why */}
          <div className="modal-field">
            <label className="modal-label">Why it matters</label>
            <textarea
              className="modal-textarea"
              rows={4}
              value={why}
              onChange={e => setWhy(e.target.value)}
              placeholder="Add your notes about why this session is relevant…"
            />
          </div>
        </div>

        {/* ── Error ── */}
        {error && <div className="modal-error">{error}</div>}

        {/* ── Actions ── */}
        <div className="modal-actions">
          <button
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={deleting || saving}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onClose} disabled={saving || deleting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || deleting}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}