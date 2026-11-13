import React, { Fragment, useState } from 'react';
import { Upload, Search, ExternalLink, Bookmark, Trash2 } from 'lucide-react';

const statuses = ['Saved', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Withdrawn'];

function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? initial; }
    catch { return initial; }
  });
  function save(next) {
    localStorage.setItem(key, JSON.stringify(next));
    setValue(next);
  }
  return [value, save];
}

async function readResume(file) {
  if (file.size > 10 * 1024 * 1024) throw Error('Choose a file under 10 MB.');
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'txt') return file.text();
  if (extension === 'docx') {
    const { extractRawText } = await import('mammoth/mammoth.browser.js');
    return (await extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  }
  if (extension !== 'pdf') throw Error('Choose a PDF, DOCX, or TXT file.');
  const pdfjs = await import('pdfjs-dist');
  const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
  try {
    if (document.numPages > 50) throw Error('Choose a PDF with 50 pages or fewer.');
    const pages = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => (item.str ?? '') + (item.hasEOL ? '\n' : ' ')).join(''));
    }
    return pages.join('\n\n');
  } finally {
    await document.destroy();
  }
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function keywords(text) {
  const common = new Set('the and for with from you your our are will has have can this that work team years role job experience'.split(' '));
  return new Set((text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? []).filter(word => !common.has(word)));
}

function Panel({ title, children }) {
  return <section className="feature-panel"><h2>{title}</h2>{children}</section>;
}

export function Workspace({ page }) {
  const [resume, saveResume] = useStored('jobbuddy-resume', { name: '', text: '' });
  const [profile, saveProfile] = useStored('jobbuddy-profile', {});
  const [jobs, saveJobs] = useStored('jobbuddy-jobs', []);
  const [applications, saveApplications] = useStored('jobbuddy-applications', {});
  const [query, setQuery] = useState('');
  const [remoteJobs, setRemoteJobs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const skillWords = keywords([resume.text, profile.skills, profile.role].filter(Boolean).join(' '));

  function attempt(action, success) {
    setError('');
    setMessage('');
    try { action(); setMessage(success); }
    catch (failure) { setError(failure.message); }
  }

  async function upload(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const text = (await readResume(file)).trim();
      if (!text) throw Error('No selectable text found. Paste your resume text below.');
      saveResume({ name: file.name, text: text.slice(0, 100000) });
      setMessage('Resume imported.');
    } catch (failure) { setError(failure.message); }
    finally { setUploading(false); }
  }

  async function discover() {
    setLoadingJobs(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('https://www.arbeitnow.com/api/job-board-api', { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw Error();
      const { data } = await response.json();
      setRemoteJobs(data.filter(job => safeUrl(job.url)).map(job => ({
        id: 'arbeitnow-' + job.slug,
        title: job.title,
        company: job.company_name,
        location: job.location,
        url: job.url,
        description: (job.tags ?? []).join(' ') + ' ' + (job.description ?? '').replace(/<[^>]*>/g, ' '),
      })));
      setMessage('Loaded listings from Arbeitnow.');
    } catch { setError('Live listings are unavailable. Try again or add a listing manually.'); }
    finally { setLoadingJobs(false); }
  }

  function addJob(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    values.url = safeUrl(values.url);
    if (!values.title.trim() || !values.company.trim() || !values.url) {
      setError('Enter a title, company, and valid application link.');
      return;
    }
    attempt(() => {
      saveJobs([{ ...values, id: crypto.randomUUID() }, ...jobs]);
      form.reset();
    }, 'Listing added.');
  }

  function track(job, status) {
    attempt(() => {
      const next = { ...applications };
      if (status) next[job.id] = { ...job, status };
      else delete next[job.id];
      saveApplications(next);
    }, status ? 'Application updated.' : 'Removed from tracker.');
  }

  let content;
  if (page === 'resume') {
    content = <Panel title="Your resume">
      <p>Import a PDF, DOCX, or TXT file, or paste your resume below. Your resume stays in this browser.</p>
      <label className="feature-button upload-button"><Upload size={16}/> {uploading ? 'Reading file…' : 'Import resume'} <input type="file" accept=".pdf,.docx,.txt" onChange={upload} disabled={uploading}/></label>
      <form onSubmit={event => {
        event.preventDefault();
        const text = new FormData(event.currentTarget).get('resume').trim();
        attempt(() => saveResume({ name: text ? resume.name || 'Pasted resume' : '', text }), 'Resume saved.');
      }}>
        <label>{resume.name || 'Resume text'}<textarea key={resume.text} name="resume" rows="14" defaultValue={resume.text} maxLength={100000}/></label>
        <div className="feature-actions"><button className="feature-button" disabled={uploading}>Save resume</button>
          {resume.text && <button type="button" disabled={uploading} className="feature-button secondary" onClick={() => attempt(() => saveResume({ name: '', text: '' }), 'Resume removed.')}><Trash2 size={15}/> Remove resume</button>}</div>
      </form>
    </Panel>;
  } else if (page === 'profile' || page === 'settings' || page === 'preferences') {
    content = <Panel title={page === 'profile' ? 'Career profile' : 'Profile preferences'}>
      <form onSubmit={event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        attempt(() => saveProfile(values), 'Profile saved.');
      }}>
        <div className="feature-fields">
          <label>Name<input name="name" autoComplete="name" defaultValue={profile.name}/></label>
          <label>Email<input name="email" type="email" autoComplete="email" defaultValue={profile.email}/></label>
          <label>Target role<input name="role" defaultValue={profile.role}/></label>
          <label>Location<input name="location" defaultValue={profile.location}/></label>
        </div>
        <label>Skills<textarea name="skills" rows="4" defaultValue={profile.skills}/></label>
        <button className="feature-button">Save profile</button>
      </form>
    </Panel>;
  } else if (page === 'applications') {
    const entries = Object.values(applications);
    content = <Panel title="Application tracker">
      {!entries.length && <p>Save a job from <a href="#jobs">Jobs</a> to start tracking it.</p>}
      {entries.map(job => <article className="job-row" key={job.id}>
        <div><h3>{job.title}</h3><p>{job.company}</p></div>
        <div className="feature-actions">
          <select aria-label={'Status for ' + job.title} value={job.status} onChange={event => track(job, event.target.value)}>
            {statuses.map(status => <option key={status}>{status}</option>)}
          </select>
          <a className="feature-button secondary" href={safeUrl(job.url)} target="_blank" rel="noreferrer">Open <ExternalLink size={14}/></a>
          <button className="feature-button secondary" aria-label={'Remove ' + job.title} onClick={() => track(job, '')}><Trash2 size={15}/></button>
        </div>
      </article>)}
    </Panel>;
  } else if (page === 'billing') {
    content = <Panel title="Workspace plan"><p>This browser workspace is free. Resume import, keyword matching, and application tracking do not use credits.</p></Panel>;
  } else {
    const listings = [...new Map([...Object.values(applications), ...remoteJobs, ...jobs].map(job => [job.id, job])).values()];
    const matches = listings.filter(job => [job.title, job.company, job.location].join(' ').toLowerCase().includes(query.toLowerCase().trim()))
      .map(job => ({ job, hits: [...keywords(job.title + ' ' + job.description)].filter(word => skillWords.has(word)).length }))
      .sort((a, b) => b.hits - a.hits);
    content = <>
      <Panel title="Find jobs">
        <p>{skillWords.size ? 'Listings are ranked by shared words from your resume and profile.' : <>Add a <a href="#resume">resume</a> or <a href="#profile">career profile</a> to rank listings by keyword overlap.</>}</p>
        <div className="feature-actions">
          <label className="search-field"><Search size={16}/><input aria-label="Filter jobs" placeholder="Filter by role, company, or location" value={query} onChange={event => setQuery(event.target.value)}/></label>
          <button className="feature-button" onClick={discover} disabled={loadingJobs}>{loadingJobs ? 'Loading…' : 'Load live jobs'}</button>
        </div>
        {!matches.length && <p>{listings.length ? 'No listings match your filter.' : 'Load live jobs or add a listing to get started.'}</p>}
        {matches.map(({ job, hits }) => <article className="job-row" key={job.id}>
          <div><h3>{job.title}</h3><p>{[job.company, job.location].filter(Boolean).join(' · ')}</p>{skillWords.size > 0 && <small>{hits} shared keywords</small>}</div>
          <div className="feature-actions"><a className="feature-button secondary" href={safeUrl(job.url)} target="_blank" rel="noreferrer">Apply on site <ExternalLink size={14}/></a>
            {applications[job.id] ? <a className="feature-button secondary" href="#applications">Tracked</a> : <button className="feature-button secondary" onClick={() => track(job, 'Saved')}><Bookmark size={15}/> Save</button>}</div>
        </article>)}
      </Panel>
      <Panel title="Add a listing">
        <form onSubmit={addJob}>
          <div className="feature-fields">
            <label>Job title<input name="title" required maxLength={150}/></label>
            <label>Company<input name="company" required maxLength={150}/></label>
            <label>Location<input name="location" maxLength={150}/></label>
            <label>Application link<input name="url" type="url" required maxLength={2000}/></label>
          </div>
          <label>Job description<textarea name="description" rows="4" maxLength={15000}/></label>
          <button className="feature-button">Add listing</button>
        </form>
      </Panel>
    </>;
  }
  return <div className="feature-content">
    <div role="status">{message}</div>
    {error && <p className="feature-error" role="alert">{error}</p>}
    <Fragment key={page}>{content}</Fragment>
  </div>;
}
