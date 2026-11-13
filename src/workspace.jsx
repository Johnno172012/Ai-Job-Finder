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

function resumeProfile(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const section = title => {
    const start = lines.findIndex(line => title.test(line));
    if (start < 0) return '';
    const end = lines.findIndex((line, index) => index > start && /^(summary|profile|objective|skills|technical skills|experience|work experience|employment|education|projects|certifications|references)\s*:?$/i.test(line));
    return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
  };
  const links = text.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in|github\.com)\/[\w.-]+/gi) ?? [];
  return {
    name: /^[\p{L}][\p{L}'’. -]{2,60}$/u.test(lines[0] ?? '') ? lines[0] : '',
    email: text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? '',
    phone: lines.slice(0, 12).join('\n').match(/(?:^|\s)(\+?\d[\d ().-]{7,}\d)(?=\s|$)/)?.[1] ?? '',
    linkedin: links.find(link => link.includes('linkedin.com')) ?? '',
    github: links.find(link => link.includes('github.com')) ?? '',
    summary: section(/^(summary|profile|objective)\s*:?$/i),
    skills: section(/^(skills|technical skills)\s*:?$/i),
    experience: section(/^(experience|work experience|employment)\s*:?$/i),
  };
}

const profileFields = [
  ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['role', 'Target role'],
  ['location', 'Location'], ['linkedin', 'LinkedIn'], ['github', 'GitHub'],
];
const pageSize = 20;

function Panel({ title, children }) {
  return <section className="feature-panel"><h2>{title}</h2>{children}</section>;
}

export function Workspace({ page }) {
  const [resume, saveResume] = useStored('jobbuddy-resume', { name: '', text: '' });
  const [profile, saveProfile] = useStored('jobbuddy-profile', {});
  const [jobs, saveJobs] = useStored('jobbuddy-jobs', []);
  const [applications, saveApplications] = useStored('jobbuddy-applications', {});
  const [query, setQuery] = useState('');
  const [jobPage, setJobPage] = useState(0);
  const [jobSource, setJobSource] = useState('');
  const [profileTab, setProfileTab] = useState('personal');
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

  function fillProfileFromResume(text) {
    const suggestions = Object.fromEntries(Object.entries(resumeProfile(text)).filter(([key, value]) => value && !profile[key]?.trim()));
    saveProfile({ ...profile, ...suggestions });
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
      fillProfileFromResume(text);
      setMessage('Resume imported. Review the filled fields in Profile.');
    } catch (failure) { setError(failure.message); }
    finally { setUploading(false); }
  }

  async function discover() {
    setLoadingJobs(true);
    setError('');
    setMessage('');
    try {
      const boards = [['cloudflare', 'Cloudflare'], ['figma', 'Figma'], ['stripe', 'Stripe']];
      const results = await Promise.allSettled(boards.map(async ([board, company]) => {
        const endpoint = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`;
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw Error(company);
        const { jobs } = await response.json();
        return jobs.filter(job => safeUrl(job.absolute_url)).map(job => ({
          id: `greenhouse-${board}-${job.id}`,
          title: job.title,
          company: job.company_name || company,
          location: job.location?.name ?? '',
          url: job.absolute_url,
          description: (job.content ?? '').replace(/&lt;[\s\S]*?&gt;|<[^>]*>/g, ' '),
        }));
      }));
      const available = results.filter(result => result.status === 'fulfilled');
      if (!available.length) throw Error();
      const listings = available.flatMap(result => result.value);
      setRemoteJobs(listings);
      setMessage(`Loaded ${listings.length} Greenhouse listings from ${available.length} of ${boards.length} employer boards.`);
    } catch { setError('Greenhouse listings are unavailable. Try again or add a listing manually.'); }
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
      <p>{[...profileFields.map(([key]) => key), 'summary', 'skills', 'experience'].filter(key => profile[key]?.trim()).length} of 10 profile fields completed.</p>
      <div className="feature-actions">
        {['personal', 'summary', 'skills', 'experience'].map(tab => <button key={tab} className="feature-button secondary" aria-pressed={profileTab === tab} onClick={() => setProfileTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
        <button className="feature-button" disabled={!resume.text} onClick={() => attempt(() => {
          fillProfileFromResume(resume.text);
        }, 'Resume details added to empty fields.')}>Fill from resume</button>
      </div>
      <form key={JSON.stringify([profileTab, profile])} onSubmit={event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        attempt(() => saveProfile({ ...profile, ...values }), 'Profile saved.');
      }}>
        {profileTab === 'personal' ? <div className="feature-fields">
          {profileFields.map(([key, label]) => <label key={key}>{label}<input name={key} type={key === 'email' ? 'email' : 'text'} defaultValue={profile[key]}/></label>)}
        </div> : <label>{profileTab[0].toUpperCase() + profileTab.slice(1)}<textarea name={profileTab} rows="8" defaultValue={profile[profileTab]}/></label>}
        <button className="feature-button">Save profile</button>
      </form>
    </Panel>;
  } else if (page === 'applications' || page === 'saved') {
    const entries = Object.values(applications).filter(job => page !== 'saved' || job.status === 'Saved');
    content = <Panel title={page === 'saved' ? 'Saved listings' : 'Application tracker'}>
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
    const matches = listings.filter(job => (!jobSource || job.company === jobSource) && [job.title, job.company, job.location].join(' ').toLowerCase().includes(query.toLowerCase().trim()))
      .map(job => ({ job, hits: [...keywords(job.title + ' ' + job.description)].filter(word => skillWords.has(word)).length }))
      .sort((a, b) => b.hits - a.hits);
    const lastPage = Math.max(0, Math.ceil(matches.length / pageSize) - 1);
    const currentPage = Math.min(jobPage, lastPage);
    content = <>
      <Panel title="Find jobs">
        <p>{skillWords.size ? 'Listings are ranked by shared words from your resume and profile.' : <>Add a <a href="#resume">resume</a> or <a href="#profile">career profile</a> to rank listings by keyword overlap.</>}</p>
        <div className="feature-actions">
          <label className="search-field"><Search size={16}/><input aria-label="Filter jobs" placeholder="Filter by role, company, or location" value={query} onChange={event => { setQuery(event.target.value); setJobPage(0); }}/></label>
          <button className="feature-button" onClick={discover} disabled={loadingJobs}>{loadingJobs ? 'Loading…' : 'Load Greenhouse jobs'}</button>
        </div>
        <div className="feature-actions">
          <label>Employer<select value={jobSource} onChange={event => { setJobSource(event.target.value); setJobPage(0); }}>
            <option value="">All employers</option>
            {[...new Set(listings.map(job => job.company))].sort().map(company => <option key={company}>{company}</option>)}
          </select></label>
          <a className="feature-button secondary" href="#saved">Saved jobs</a>
        </div>
        {!matches.length && <p>{listings.length ? 'No listings match your filter.' : 'Load live jobs or add a listing to get started.'}</p>}
        {matches.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(({ job, hits }) => <article className="job-row" key={job.id}>
          <div><h3>{job.title}</h3><p>{[job.company, job.location].filter(Boolean).join(' · ')}</p>{skillWords.size > 0 && <small>{hits} shared keywords</small>}</div>
          <div className="feature-actions"><a className="feature-button secondary" href={safeUrl(job.url)} target="_blank" rel="noreferrer">Apply on site <ExternalLink size={14}/></a>
            {applications[job.id] ? <a className="feature-button secondary" href="#applications">Tracked</a> : <button className="feature-button secondary" onClick={() => track(job, 'Saved')}><Bookmark size={15}/> Save</button>}</div>
        </article>)}
        {lastPage > 0 && <div className="feature-actions job-row" aria-label="Job results pages">
          <button className="feature-button secondary" disabled={currentPage === 0} onClick={() => setJobPage(currentPage - 1)}>Previous</button>
          <span>Page {currentPage + 1} of {lastPage + 1}</span>
          <button className="feature-button secondary" disabled={currentPage === lastPage} onClick={() => setJobPage(currentPage + 1)}>Next</button>
        </div>}
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
