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
      <div>
        <h1>Sell Here — Field Map</h1>
        <p className="subtitle">Where our farmers, traders and warehouses are.</p>
      </div>
      <form onSubmit={submit} className="login-card">
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="subtitle">Team access only. Ask an admin for an account.</p>
    </main>
  );
}
