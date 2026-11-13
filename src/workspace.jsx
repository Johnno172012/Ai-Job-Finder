import { cloud } from './cloud.jsx';
import React, { Fragment, useEffect, useState } from 'react';
import { Upload, Search, ExternalLink, Bookmark, Trash2 } from 'lucide-react';

const statuses = ['Saved', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Withdrawn'];

function useStored(key, initial, account) {
  const kind = key.slice(9);
  const [value, setValue] = useState(() => {
    if (account) return account.records[kind] ?? initial;
    try { return JSON.parse(localStorage.getItem(key)) ?? initial; }
    catch { return initial; }
  });
  async function save(next) {
    if (account) await account.save(kind, next);
    else localStorage.setItem(key, JSON.stringify(next));
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

const platforms = ['Greenhouse', 'Lever', 'Workable', 'Wellfound'];

async function fetchJobs(source, terms) {
  async function get(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (response.status === 503 && url.startsWith('/api/')) throw Error('Requires Brave Search setup');
    if (!response.ok) throw Error('Unavailable');
    return response.json();
  }

  let jobs;
  if (source === 'Greenhouse') {
    const boards = [['cloudflare', 'Cloudflare'], ['figma', 'Figma'], ['stripe', 'Stripe']];
    const results = await Promise.allSettled(boards.map(async ([board, company]) => {
      const data = await get(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`);
      return data.jobs.map(job => ({
        id: `greenhouse-${board}-${job.id}`, title: job.title, company: job.company_name || company,
        location: job.location?.name ?? '', url: job.absolute_url,
        description: (job.content ?? '').replace(/&lt;[\s\S]*?&gt;|<[^>]*>/g, ' '),
      }));
    }));
    if (results.every(result => result.status === 'rejected')) throw Error('Unavailable');
    jobs = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  } else if (source === 'Lever') {
    const data = await get('https://api.lever.co/v0/postings/spotify?mode=json');
    jobs = data.map(job => ({
      id: `lever-spotify-${job.id}`, title: job.text, company: 'Spotify',
      location: job.categories?.location ?? '', url: job.hostedUrl,
      description: job.descriptionPlain ?? '',
    }));
  } else {
    jobs = await get(`/api/job-search?source=${source}&terms=${encodeURIComponent(terms)}`);
    if (!Array.isArray(jobs)) throw Error('Requires Brave Search setup');
  }
  return jobs.filter(job => safeUrl(job.url)).map(job => ({ ...job, source }));
}

const companyLogos = {
  cloudflare: 'cloudflare',
  figma: 'figma',
  stripe: 'stripe',
  spotify: 'spotify',
};

function CompanyLogo({ company = '' }) {
  const name = company.trim();
  const logo = Object.hasOwn(companyLogos, name.toLowerCase()) ? companyLogos[name.toLowerCase()] : null;
  const [failedLogo, setFailedLogo] = useState(null);
  if (!logo || failedLogo === logo) {
    return <span className="company-logo company-initials" aria-hidden="true">
      {name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '•'}
    </span>;
  }
  return <img className="company-logo" src={import.meta.env.BASE_URL + 'logos/' + logo + '.svg'}
    alt="" width="34" height="34" loading="lazy" onError={() => setFailedLogo(logo)}/>;
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
    education: section(/^education\s*:?$/i),
    projects: section(/^projects\s*:?$/i),
    certifications: section(/^certifications\s*:?$/i),
  };
}

const profileFields = [
  ['name', 'Full name'], ['email', 'Email'], ['phone', 'Phone'], ['role', 'Target role'],
  ['location', 'Location'], ['headline', 'Headline'], ['linkedin', 'LinkedIn URL'], ['github', 'GitHub URL'], ['website', 'Website'],
];
const pageSize = 20;

function Panel({ title, children }) {
  return <section className="feature-panel"><h2>{title}</h2>{children}</section>;
}

export function useResume(account) {
  return useStored('jobbuddy-resume', { name: '', text: '' }, account);
}

export function Workspace({ page, resume, saveResume, locked, account }) {
  const [profile, saveProfile] = useStored('jobbuddy-profile', {}, account);
  const [applications, saveApplications] = useStored('jobbuddy-applications', {}, account);
  const [platform, setPlatform] = useState('');
  const [sourceStatus, setSourceStatus] = useState({});
  const [query, setQuery] = useState('');
  const [jobPage, setJobPage] = useState(0);
  const [jobSource, setJobSource] = useState('');
  const [profileTab, setProfileTab] = useState('personal');
  const [cache, saveCache] = useStored('jobbuddy-jobs', {}, account);
  const [remoteJobs, setRemoteJobs] = useState(() => cache.jobs ?? []);
  const [uploading, setUploading] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const searchTerms = [profile.role, profile.location, profile.skills?.split(/[,\n]/).slice(0, 3).join(' ')]
    .filter(Boolean).join(' ').slice(0, 120);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const skillWords = keywords([resume.text, profile.skills, profile.role].filter(Boolean).join(' '));

  async function attempt(action, success) {
    setError('');
    setMessage('');
    try { await action(); setMessage(success); }
    catch (failure) { setError(failure.message); }
  }

  async function fillProfileFromResume(text) {
    let extracted = resumeProfile(text);
    if (account) {
      const { data } = await cloud.auth.getSession();
      const response = await fetch('/api/resume-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token },
        body: JSON.stringify({ text: text.slice(0, 10000) }),
        signal: AbortSignal.timeout(25000),
      });
      const profile = await response.json();
      if (!response.ok) throw Error(profile.error);
      extracted = { ...extracted, ...Object.fromEntries(Object.entries(profile).filter(([, value]) => value)) };
    }
    const suggestions = Object.fromEntries(Object.entries(extracted).filter(([key, value]) => value && !profile[key]?.trim()));
    return saveProfile({ ...profile, ...suggestions });
  }

  async function upload(file) {
    if (!file || uploading) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const text = (await readResume(file)).trim();
      if (!text) throw Error('No selectable text found. Choose a text-based PDF, DOCX, or TXT resume.');
      const path = account ? account.userId + '/' + crypto.randomUUID() : '';
      if (path) {
        const { error } = await cloud.storage.from('resume').upload(path, file);
        if (error) throw error;
      }
      try {
        await fillProfileFromResume(text);
        await saveResume({ name: file.name, text: text.slice(0, 100000), path });
      } catch (error) {
        if (path) await cloud.storage.from('resume').remove([path]);
        throw error;
      }
      if (resume.path) await cloud.storage.from('resume').remove([resume.path]);
      setMessage('Resume imported. Review the filled fields in Profile.');
    } catch (failure) { setError(failure.message); }
    finally { setUploading(false); }
  }

  async function discover() {
    setLoadingJobs(true);
    setError('');
    const sources = platforms;
    const results = await Promise.allSettled(sources.map(source => fetchJobs(source, searchTerms)));
    const statuses = Object.fromEntries(sources.map((source, index) => {
      const result = results[index];
      return [source, result.status === 'fulfilled' ? `${result.value.length} listings` : result.reason.message];
    }));
    setSourceStatus(statuses);
    const refreshed = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const failed = new Set(sources.filter((_, index) => results[index].status === 'rejected'));
    const jobs = [...remoteJobs.filter(job => failed.has(job.source)), ...refreshed];
    setRemoteJobs(jobs);
    if (refreshed.length) {
      try { await saveCache({ jobs, statuses, terms: searchTerms, fetchedAt: Date.now() }); }
      catch { setError('Jobs loaded, but the cache could not be saved.'); }
    }
    setJobPage(0);
    setLoadingJobs(false);
  }

  useEffect(() => {
    if (page !== 'jobs' || loadingJobs) return;
    const cacheIsFresh = cache.terms === searchTerms && Date.now() - cache.fetchedAt < 21600000;
    if (cacheIsFresh) {
      setSourceStatus(cache.statuses ?? {});
    } else {
      discover();
    }
  }, [page, searchTerms]);

  function track(job, status) {
    attempt(async () => {
      const next = { ...applications };
      if (status) next[job.id] = { ...job, status };
      else delete next[job.id];
      await saveApplications(next);
    }, status ? 'Application updated.' : 'Removed from tracker.');
  }

  const profileChecks = [
    ['Basic information', profile.name && profile.email],
    ['Summary', profile.summary],
    ['Work experience', profile.experience],
    ['Education', profile.education],
    ['Skills', profile.skills],
    ['Resume', resume.text],
  ];
  const completion = Math.round(100 * profileChecks.filter(([, value]) => value?.trim()).length / profileChecks.length);
  const profileCompleteness = <Panel title="Profile completeness">
          <div className="completion-ring" style={{ '--completion': completion + '%' }}><strong>{completion}%</strong></div>
          <ul className="profile-checks">
            {profileChecks.map(([label, value]) => <li key={label}><span aria-hidden="true">{value?.trim() ? '✓' : '○'}</span> {label}<span className="visually-hidden">{value?.trim() ? ' complete' : ' incomplete'}</span></li>)}
          </ul>
          <a className="feature-button" href={resume.text ? '#profile' : '#resume'}>{resume.text ? 'Improve profile' : 'Upload resume'}</a>
        </Panel>;
  let content;
  if (page === 'resume') {
    content = <Panel title="Your resume">
      <p>{locked
        ? 'Upload your resume to unlock Jobs, Saved Jobs, Profile, and Application Status. Your resume is saved to your workspace.'
        : 'Import a replacement or edit your saved resume text below. Your resume is saved to your workspace.'}</p>
      {account && <p>Uploading a resume sends up to 10,000 characters of its text to Google Gemini to extract your profile details.</p>}
      <div className="resume-drop" onDragOver={event => event.preventDefault()} onDrop={event => {
        event.preventDefault();
        upload(event.dataTransfer.files[0]);
      }}>
        <Upload size={26} aria-hidden="true"/>
        <strong>Drop your resume here</strong>
        <small>PDF, DOCX, or TXT · Up to 10 MB</small>
        <label className="feature-button upload-button">
          {uploading ? 'Reading file…' : 'Choose file'}
          <input type="file" accept=".pdf,.docx,.txt" onChange={event => {
            upload(event.target.files[0]);
            event.target.value = '';
          }} disabled={uploading}/>
        </label>
      </div>
      {!locked && <form onSubmit={event => {
        event.preventDefault();
        const text = new FormData(event.currentTarget).get('resume').trim();
        attempt(() => saveResume({ ...resume, text }), 'Resume saved.');
      }}>
        <label>{resume.name || 'Resume text'}<textarea key={resume.text} name="resume" rows="14" defaultValue={resume.text} maxLength={100000}/></label>
        <div className="feature-actions"><button className="feature-button" disabled={uploading}>Save resume</button>
          {resume.text && <button type="button" disabled={uploading} className="feature-button secondary" onClick={() => attempt(async () => {
            if (resume.path) {
              const { error } = await cloud.storage.from('resume').remove([resume.path]);
              if (error) throw error;
            }
            await saveResume({ name: '', text: '' });
          }, 'Resume removed.')}><Trash2 size={15}/> Remove resume</button>}</div>
      </form>}
    </Panel>;
  } else if (page === 'profile' || page === 'settings' || page === 'preferences') {
    content = <div className="profile-layout">{profileCompleteness}<Panel title={page === 'profile' ? 'Career profile' : 'Profile preferences'}>
      <p>Review and edit the information extracted from your resume.</p>
      <div className="feature-actions">
        {['personal', 'summary', 'skills', 'experience', 'education', 'projects', 'certifications'].map(tab => <button key={tab} className="feature-button secondary" aria-pressed={profileTab === tab} onClick={() => setProfileTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
        <button className="feature-button" disabled={!resume.text} onClick={() => attempt(() => {
          return fillProfileFromResume(resume.text);
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
    </Panel></div>;
  } else if (page === 'applications' || page === 'saved') {
    const entries = Object.values(applications).filter(job => page !== 'saved' || job.status === 'Saved');
    content = <Panel title={page === 'saved' ? 'Saved listings' : 'Application tracker'}>
      {!entries.length && <p>Save a job from <a href="#jobs">Jobs</a> to start tracking it.</p>}
      {entries.map(job => <article className="job-row" key={job.id}>
        <div className="job-identity"><CompanyLogo company={job.company}/><div><h3>{job.title}</h3><p>{job.company}</p></div></div>
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
    const listings = remoteJobs;
    const matches = listings.filter(job => (!platform || job.source === platform) && (!jobSource || job.company === jobSource) && [job.title, job.company, job.location].join(' ').toLowerCase().includes(query.toLowerCase().trim()))
      .map(job => ({ job, hits: [...keywords(job.title + ' ' + job.description)].filter(word => skillWords.has(word)).length }))
      .sort((a, b) => b.hits - a.hits);
    const lastPage = Math.max(0, Math.ceil(matches.length / pageSize) - 1);
    const currentPage = Math.min(jobPage, lastPage);
    content = <div className="jobs-dashboard">
      <div className="jobs-results">
      <Panel title={profile.name?.trim() ? `Welcome, ${profile.name.trim().split(/\s+/)[0]}` : 'Welcome to Jobs'}>
        <p>{matches.length ? `Showing ${currentPage * pageSize + 1}–${Math.min(matches.length, (currentPage + 1) * pageSize)} of ${matches.length} matching listings.` : 'Browse live listings and save roles you want to apply for.'}</p>
      </Panel>
      <Panel title="Top job matches">
        <p>{skillWords.size ? 'Listings are ranked by shared words from your resume and profile.' : <>Add a <a href="#resume">resume</a> or <a href="#profile">career profile</a> to rank listings by keyword overlap.</>}</p>
        <h3>Job platforms</h3>
        <div className="job-platforms" aria-label="Filter by job platform">
          {platforms.map(source => <button key={source} type="button" className="job-platform"
            aria-pressed={platform === source} onClick={() => {
              setPlatform(platform === source ? '' : source);
              setJobSource('');
              setJobPage(0);
            }}>
            <span className="platform-mark" aria-hidden="true">{source[0]}</span>
            <span><strong>{source}</strong><small>{sourceStatus[source] ?? 'Job board'}</small></span>
          </button>)}
        </div>
        <div className="feature-actions">
          <label className="search-field"><Search size={16}/><input aria-label="Filter jobs" placeholder="Filter by role, company, or location" value={query} onChange={event => { setQuery(event.target.value); setJobPage(0); }}/></label>
          <button className="feature-button" onClick={discover} disabled={loadingJobs}>{loadingJobs ? 'Loading…' : 'Refresh jobs'}</button>
        </div>
        <div className="feature-actions">
          <label>Employer<select value={jobSource} onChange={event => { setJobSource(event.target.value); setJobPage(0); }}>
            <option value="">All employers</option>
            {[...new Set(listings.filter(job => (!platform || job.source === platform) && job.company).map(job => job.company))].sort().map(company => <option key={company}>{company}</option>)}
          </select></label>
          <a className="feature-button secondary" href="#saved">Saved jobs</a>
        </div>
        {!matches.length && <p>{listings.length ? 'No listings match your filter.' : loadingJobs ? 'Loading live jobs…' : 'No listings loaded. Refresh to try again.'}</p>}
        {matches.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(({ job, hits }) => <article className="job-row job-result" key={job.id}>
          <div className="job-identity"><CompanyLogo company={job.company}/><div><h3>{job.title}</h3><small>{job.source}</small><p>{[job.company, job.location].filter(Boolean).join(' · ')}</p>{skillWords.size > 0 && <small>{hits} shared keywords</small>}</div></div>
          <div className="feature-actions"><a className="feature-button secondary" href={safeUrl(job.url)} target="_blank" rel="noreferrer">Apply on site <ExternalLink size={14}/></a>
            {applications[job.id] ? <a className="feature-button secondary" href="#applications">Tracked</a> : <button className="feature-button secondary" onClick={() => track(job, 'Saved')}><Bookmark size={15}/> Save</button>}</div>
        </article>)}
        {lastPage > 0 && <div className="feature-actions job-row" aria-label="Job results pages">
          <button className="feature-button secondary" disabled={currentPage === 0} onClick={() => setJobPage(currentPage - 1)}>Previous</button>
          <span>Page {currentPage + 1} of {lastPage + 1}</span>
          <button className="feature-button secondary" disabled={currentPage === lastPage} onClick={() => setJobPage(currentPage + 1)}>Next</button>
        </div>}
      </Panel>
      </div>
      <aside className="jobs-overview" aria-label="Workspace overview">
        {profileCompleteness}
        <Panel title="Recent activity">
          {Object.values(applications).slice(-4).reverse().map(job => <p key={job.id}><strong>{job.title}</strong><br/>{job.status} · {job.company}</p>)}
          {!Object.keys(applications).length && <p>Saved jobs and applications will appear here.</p>}
          <a className="feature-button secondary" href="#applications">View applications</a>
        </Panel>
      </aside>
    </div>;
  }
  return <div className={['jobs', 'profile', 'settings', 'preferences'].includes(page) ? 'feature-content feature-content-wide' : 'feature-content'}>
    <div role="status">{message}</div>
    {error && <p className="feature-error" role="alert">{error}</p>}
    <Fragment key={page}>{content}</Fragment>
  </div>;
}
