import { MapTrifold, ArrowRight, LockSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import { supabase } from './supabase';

/** Email + password. Accounts are created by hand in the Supabase dashboard. */
export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    setBusy(false);
  };

  return (
    <main className="login-band">
      <div className="login-intro">
        <span className="login-app-icon"><MapTrifold size={44} weight="duotone" aria-hidden="true" /></span>
        <span className="eyebrow">SELL HERE</span><h1>Your world.<br />Well connected.</h1>
        <p className="subtitle">Your people, places, and field notes. All on one map.</p>
      </div>
      <form onSubmit={submit} className="login-card">
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password" autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'} <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
      <p className="subtitle login-access"><LockSimple size={13} aria-hidden="true" /> Team access only. Ask an admin for an account.</p>
    </main>
  );
}
