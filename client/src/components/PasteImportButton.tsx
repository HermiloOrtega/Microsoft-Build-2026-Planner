import { useState } from 'react';
import { pasteImport } from '../api/sessions';
import { SyncResult } from '../types';
import { usePassword } from '../context/PasswordContext';

interface Props {
  onImportComplete: () => void;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function PasteImportButton({ onImportComplete }: Props) {
  const { password } = usePassword();
  const [open,    setOpen]    = useState(false);
  const [text,    setText]    = useState('');
  const [status,  setStatus]  = useState<Status>('idle');
  const [result,  setResult]  = useState<SyncResult | null>(null);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);

  function handleOpen() {
    setOpen(true);
    setStatus('idle');
    setResult(null);
    setErrMsg(null);
  }

  function handleClose() {
    if (status === 'loading') return;
    setOpen(false);
    setText('');
    setStatus('idle');
    setResult(null);
    setErrMsg(null);
  }

  async function handleImport() {
    if (!text.trim()) return;
    setStatus('loading');
    setResult(null);
    setErrMsg(null);
    try {
      const res = await pasteImport(text, password);
      setResult(res);
      setStatus('success');
      onImportComplete();
    } catch (err: any) {
      setErrMsg(err.message);
      setStatus('error');
    }
  }

  return (
    <>
      <button className="sync-btn" onClick={handleOpen} title="Import sessions by pasting page text">
        <span className="sync-icon">⎘</span>
        Paste import
      </button>

      {open && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <div className="modal-header-left">
                <span className="modal-code">Paste Import</span>
              </div>
              <div className="modal-header-right">
                <button className="modal-close" onClick={handleClose} disabled={status === 'loading'}>✕</button>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
              Go to <strong style={{ color: 'var(--text)' }}>build.microsoft.com/en-US/sessions</strong>, select all
              text on the page (Ctrl+A), copy it, then paste below. Works across multiple pages — just paste
              and import as many times as needed; duplicates are automatically ignored.
            </p>

            <div className="modal-field">
              <label className="modal-label">Paste session page text</label>
              <textarea
                className="modal-textarea"
                style={{ height: 320, resize: 'vertical', fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}
                placeholder="Paste the full page text here…"
                value={text}
                onChange={e => setText(e.target.value)}
                disabled={status === 'loading'}
                spellCheck={false}
              />
            </div>

            {status === 'error' && errMsg && (
              <div className="modal-error">{errMsg}</div>
            )}

            {status === 'success' && result && (
              <div style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12,
                color: 'var(--high)',
                marginBottom: 14,
              }}>
                ✓ Imported {result.total} sessions
                {result.inserted > 0 && ` · ${result.inserted} new`}
                {result.updated  > 0 && ` · ${result.updated} updated`}
                {result.errors.length > 0 && ` · ${result.errors.length} errors`}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={status === 'loading' || !text.trim()}
              >
                {status === 'loading' ? (
                  <><span className="sync-spinner" style={{ marginRight: 6 }} />Importing…</>
                ) : 'Import sessions'}
              </button>
              <button className="btn btn-secondary" onClick={handleClose} disabled={status === 'loading'}>
                {status === 'success' ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
