import { useState } from 'react';
import { Flag } from 'lucide-react';
import { backendReady, callFn } from '../lib/supabase';
import { deviceToken } from '../lib/device';

/** "Report an error" on any record. Sends to the verification queue; resolved items appear in the public corrections log. */
export function FlagButton({ table, id, label = 'Report an error' }: { table: string; id: string; label?: string }) {
  const [open, setOpen] = useState(false); const [msg, setMsg] = useState(''); const [email, setEmail] = useState(''); const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle'); const [err, setErr] = useState('');
  const submit = async () => {
    setState('sending');
    try { await callFn('feedback', { action: 'flag', device_token: deviceToken(), record_table: table, record_id: id, message: msg, email: email || undefined }); setState('done'); }
    catch (e) { setErr((e as Error).message); setState('error'); }
  };
  if (!backendReady) return null;
  return (
    <span>
      <button className="btn small" onClick={() => setOpen(!open)}><Flag size={13} /> {label}</button>
      {open && (
        <div className="card" style={{ marginTop: 8 }}>
          {state === 'done' ? <p className="small" style={{ margin: 0 }}>Thank you. This goes to the review queue. If it changes the record, the correction will appear in the public corrections log.</p> : (
            <>
              <label className="field"><span>What does the record get wrong? <span className="hint">Quote the minutes or document if you can.</span></span><textarea className="input" value={msg} onChange={(e) => setMsg(e.target.value)} minLength={10} /></label>
              <label className="field"><span>Email <span className="hint">optional, only to follow up</span></span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              {state === 'error' && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
              <div className="row"><button className="btn primary small" disabled={msg.trim().length < 10 || state === 'sending'} onClick={submit}>Send</button><button className="btn small" onClick={() => setOpen(false)}>Cancel</button></div>
            </>
          )}
        </div>
      )}
    </span>
  );
}
