import React, { useState } from 'react';
import { triggerSync } from '../api/sessions';
import { SyncResult } from '../types';
import { usePassword } from '../context/PasswordContext';

interface Props {
  onSyncComplete: () => void;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function SyncButton({ onSyncComplete }: Props) {
  const { password } = usePassword();
  const [status,  setStatus]  = useState<Status>('idle');
  const [result,  setResult]  = useState<SyncResult | null>(null);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);

  async function handleSync() {
    setStatus('loading');
    setResult(null);
    setErrMsg(null);
    try {
      const res = await triggerSync(password);
      setResult(res);
      setStatus('success');
      onSyncComplete();
      // Auto-reset after 8 seconds
      setTimeout(() => setStatus('idle'), 8000);
    } catch (err: any) {
      setErrMsg(err.message);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 8000);
    }
  }

  return (
    <div className="sync-wrap">
      <button
        className={`sync-btn${status === 'loading' ? ' loading' : ''}`}
        onClick={handleSync}
        disabled={status === 'loading'}
        title="Scrape build.microsoft.com and sync sessions to DB"
      >
        {status === 'loading' ? (
          <>
            <span className="sync-spinner" />
            Syncing…
          </>
        ) : (
          <>
            <span className="sync-icon">⟳</span>
            Sync sessions
          </>
        )}
      </button>

      {status === 'success' && result && (
        <span className="sync-msg sync-ok">
          ✓ Synced {result.total} sessions
          {result.inserted > 0 && ` · ${result.inserted} new`}
          {result.updated  > 0 && ` · ${result.updated} updated`}
          {result.errors.length > 0 && ` · ${result.errors.length} errors`}
        </span>
      )}

      {status === 'error' && errMsg && (
        <span className="sync-msg sync-err">
          ✗ {errMsg}
        </span>
      )}
    </div>
  );
}