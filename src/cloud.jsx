import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud = url && key ? createClient(url, key) : null;

export function AccountGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [register, setRegister] = useState(false);
  useEffect(() => {
    if (!cloud) return;
    const { data: { subscription } } = cloud.auth.onAuthStateChange((_, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);
  if (!cloud) return children(null);
  if (session === undefined) return <main>Checking your session…</main>;
  if (session) return children(session.user.id);

  async function authenticate(action) {
    setBusy(true);
    setNotice('');
    try {
      const { data, error } = await action();
      if (error) throw error;
      if (register && !data.session) setNotice('Check your email to confirm your account.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  const redirect = location.origin + location.pathname;
  return <div className="onboarding-shell"><main>
    <section className="feature-panel">
      <h1>{register ? 'Create your account' : 'Welcome to JobBuddy AI'}</h1>
      <p>Sign in to access your resume and job search workspace.</p>
      <button className="feature-button secondary" disabled={busy} onClick={() =>
        authenticate(() => cloud.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } }))
      }>Continue with Google</button>
      <form onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const credentials = { email: form.get('email'), password: form.get('password') };
        authenticate(() => register
          ? cloud.auth.signUp({ ...credentials, options: { emailRedirectTo: redirect } })
          : cloud.auth.signInWithPassword(credentials));
      }}>
        <label>Email<input name="email" type="email" autoComplete="email" required/></label>
        <label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required/></label>
        <button className="feature-button" disabled={busy}>{register ? 'Create account' : 'Sign in'}</button>
      </form>
      <p><button className="feature-button secondary" onClick={() => {
        setRegister(!register);
        setNotice('');
        setBusy(false);
      }}>{register ? 'Back to sign in' : 'Create an account'}</button></p>
      <p role="status">{notice.trim()}</p>
    </section>
  </main></div>;
}

export function CloudWorkspace({ userId, children }) {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function load() {
      try {
        const { data, error } = await cloud.from('jobbuddy_workspace').select('kind,data').eq('user_id', userId);
        if (error) throw error;
        if (active) setRecords(Object.fromEntries(data.map(row => [row.kind, row.data])));
      } catch (failure) {
        if (active) setError(failure.message);
      }
    }
    load();
    return () => { active = false; };
  }, [userId, revision]);
  if (!userId) return children(null);
  if (error) return <main><p role="alert">Could not load your workspace. {error}</p><button className="feature-button" onClick={() => {
    setError('');
    setRevision(value => value + 1);
  }}>Retry</button></main>;
  if (!records) return <main>Loading your workspace…</main>;

  async function save(kind, data) {
    const { error } = await cloud.from('jobbuddy_workspace').upsert({ user_id: userId, kind, data });
    if (error) throw error;
    setRecords(previous => ({ ...previous, [kind]: data }));
  }

  return children({ userId, records, save });
}
