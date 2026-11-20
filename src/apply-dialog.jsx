import React, { useEffect, useRef, useState } from 'react';

export function ApplyDialog({ job, profile, application, onClose, onSave }) {
  const dialog = useRef(null);
  let applicationUrl = '';
  try {
    const url = new URL(job.url);
    if (['http:', 'https:'].includes(url.protocol)) applicationUrl = url.href;
  } catch {
    // A legacy saved listing may no longer have a valid application URL.
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const missing = [['name', 'Full name'], ['email', 'Email'], ['phone', 'Phone']]
    .filter(([key]) => !profile[key]?.trim());

  useEffect(() => {
    dialog.current.showModal();
  }, []);

  async function markApplied() {
    setBusy(true);
    setError('');
    try {
      await onSave();
      onClose();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <dialog ref={dialog} className="apply-dialog" onCancel={event => {
    if (busy) event.preventDefault();
    else onClose();
  }} aria-labelledby="apply-title">
    <h2 id="apply-title">Apply for {job.title}</h2>
    <p>{job.company || job.source}</p>
    <p>Open the employer’s application, complete it, then return to update your tracker.</p>
    {missing.length > 0 && <div className="application-warning">
      <strong>Your profile is missing</strong>
      <ul>{missing.map(([key, label]) => <li key={key}>{label}</li>)}</ul>
      <a href="#profile" onClick={onClose}>Complete profile</a>
    </div>}
    <div className="feature-actions">
      {applicationUrl ? <a className="feature-button" href={applicationUrl} target="_blank" rel="noreferrer">Apply manually ↗</a>
        : <p role="alert">This listing has no valid application link.</p>}
      <button className="feature-button secondary" disabled={busy} onClick={markApplied}>
        {busy ? 'Saving…' : application?.status === 'Applied' ? 'Confirm applied' : 'I submitted this application'}
      </button>
    </div>
    <p>Automatic applications require Browserbase and a configured background worker.</p>
    {error && <p role="alert">{error}</p>}
    <button className="feature-button secondary" disabled={busy} onClick={onClose}>Close</button>
  </dialog>;
}
