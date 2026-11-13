import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BriefcaseBusiness, FileText, UserRound, Layers, PanelLeftClose, PanelLeftOpen, ChevronDown, ChevronRight, CreditCard, Bookmark, Sparkles, ArrowUpRight, Settings2, SlidersHorizontal, Menu, X, Check } from 'lucide-react';
import './styles.css';
import { useResume, Workspace } from './workspace.jsx';

const pages = [
  { id: 'jobs', name: 'Jobs', icon: BriefcaseBusiness },
  { id: 'saved', name: 'Saved Jobs', icon: Bookmark },
  { id: 'resume', name: 'Resume', icon: FileText },
  { id: 'profile', name: 'Profile', icon: UserRound },
  { id: 'applications', name: 'Application Status', icon: Layers },
];
const extras = [{ id: 'billing', name: 'Billing / Credits', icon: CreditCard }, { id: 'settings', name: 'Profile settings', icon: Settings2 }, { id: 'preferences', name: 'Preferences', icon: SlidersHorizontal }];
const getPage = () => [...pages, ...extras].find(p => p.id === location.hash.slice(1)) || pages[0];
// Independent seeded samples avoid rows and keep the sky stable on re-render.
function createStars(count, seed) {
  const random = () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const colors = ['#fffaf0', '#f4f7ff', '#fff0d7', '#e0ebff', '#ffffff'];
  return Array.from({ length: count }, () => {
    const bright = random() > 0.93;
    return {
      bright,
      style: {
        left: `${random() * 100}%`,
        top: `${random() * 100}%`,
        '--star-size': `${bright ? 1.8 + random() * 1.1 : 0.65 + random() * 1.25}px`,
        '--star-opacity': bright ? 0.75 + random() * 0.25 : 0.2 + random() * 0.65,
        '--star-color': colors[Math.floor(random() * colors.length)],
        '--twinkle-duration': `${3.5 + random() * 8}s`,
        animationDelay: `${-random() * 14}s`,
      },
    };
  });
}
const stars = createStars(220, 72819);
const sidebarStars = createStars(70, 39127);
function Starfield({ sidebar = false }) {
  return <div className={`cosmic-background ${sidebar ? 'sidebar-sky' : ''}`} aria-hidden="true">
    <div className="nebula nebula-violet"/><div className="nebula nebula-blue"/><div className="nebula nebula-rose"/>
    <div className="starfield">{(sidebar ? sidebarStars : stars).map(({ style, bright }, i) => <span key={i} className={`star ${bright ? 'star-bright' : ''}`} style={style}/>)}</div>
    <div className="shooting-star shooting-star-one"/><div className="shooting-star shooting-star-two"/><div className="shooting-star shooting-star-three"/>
  </div>;
}
function Landing({ ready }) {
  return <div className="landing">
    <header className="landing-nav">
      <a className="brand" href="#"><span className="brand-symbol"><BriefcaseBusiness size={19}/></span>JobBuddy AI</a>
      <a className="feature-button" href={ready ? '#jobs' : '#resume'}>{ready ? 'Open workspace' : 'Get started'} <ArrowUpRight size={16}/></a>
    </header>
    <main className="landing-main">
      <h1>Your job search, in one place.</h1>
      <p>Upload your resume, find live job listings, and track every application.</p>
      <section className="landing-preview" aria-label="Example workspace">
        <div className="preview-bar"><span aria-hidden="true">● ● ●</span> Workspace / Jobs <small>Example</small></div>
        <div className="preview-grid">
          <div className="preview-card">
            <h2>Profile setup</h2>
            <ul><li><Check size={16}/> Upload your resume</li><li><Check size={16}/> Review extracted details</li><li><BriefcaseBusiness size={16}/> Find matching roles</li></ul>
          </div>
          <div className="preview-card">
            <h2>Application tracker</h2>
            {[['Frontend Engineer', 'Applied'], ['Product Designer', 'Interviewing'], ['Full Stack Developer', 'Saved']].map(([role, status]) =>
              <div className="preview-job" key={role}><strong>{role}</strong><span>{status}</span></div>
            )}
          </div>
        </div>
      </section>
    </main>
  </div>;
}

function App() {
  const [route, setRoute] = useState(() => location.hash);
  const requestedPage = getPage();
  const landing = route === '' || route === '#';
  const [resume, saveResume] = useResume();
  const locked = !resume.text?.trim() || !/\.(pdf|docx|txt)$/i.test(resume.name ?? '');
  const page = locked ? pages[0] : requestedPage;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('jobbuddy-sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => { const update = () => { setRoute(location.hash); setMobileOpen(false); setAccountOpen(false); }; window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  useEffect(() => { document.title = landing ? 'JobBuddy AI' : `${locked ? 'Upload resume' : page.name} · JobBuddy AI`; }, [landing, locked, page]);
  useEffect(() => { const close = e => { if(e.key === 'Escape') { setAccountOpen(false); setMobileOpen(false); } }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  useEffect(() => {
    if (!landing && locked && location.hash !== '#resume') location.replace('#resume');
  }, [landing, locked, route]);
  if (landing) return <Landing ready={!locked}/>;
  const toggle = () => setCollapsed(v => { localStorage.setItem('jobbuddy-sidebar', v ? 'expanded' : 'collapsed'); return !v; });
  const navigate = id => { location.hash = id; setMobileOpen(false); setAccountOpen(false); };
  const navLink = p => <a key={p.id} href={`#${p.id}`} className={`nav-link ${page.id === p.id ? 'active' : ''}`} aria-current={page.id === p.id ? 'page' : undefined} data-tooltip={p.name} onClick={() => { setMobileOpen(false); setAccountOpen(false); }}><p.icon size={19}/><span className="nav-label">{p.name}</span>{page.id === p.id && <span className="active-dot"/>}</a>;
  return <>
  <div inert={locked} className={`app ${collapsed ? 'is-collapsed' : ''}`}>
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation"/>}
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Main navigation"><Starfield sidebar/>
      <div className="brand-row"><a className="brand" href="#jobs" aria-label="JobBuddy AI home"><span className="brand-symbol"><BriefcaseBusiness size={20} strokeWidth={1.8}/><span className="brand-spark">✦</span></span><span className="brand-name">JobBuddy <span>AI</span></span></a><button className="mobile-close icon-button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18}/></button></div>
      <button className="workspace" data-tooltip="Personal workspace" onClick={() => navigate('profile')}><span className="workspace-avatar">J<span/></span><span className="workspace-label"><strong>My workspace</strong><small>Personal account</small></span><ChevronDown size={14} className="workspace-chevron"/></button>
      <div className="nav-section"><div className="section-label">WORKSPACE</div><nav>{pages.map(navLink)}</nav></div>
      <div className="sidebar-bottom">
        <div className="credit-card" data-tooltip="Free workspace"><div className="credit-heading"><span className="credit-icon"><Sparkles size={15}/></span><span className="credit-title">Your credits</span><span className="plan-label">FREE</span></div><div className="credit-balance"><strong>0</strong><span>credits required</span></div><div className="credit-meter"><span/></div><div className="credit-note">Workspace features are free</div><button className="upgrade-button" onClick={() => navigate('billing')}><span>View plan</span><ArrowUpRight size={15}/></button></div>
        <nav className="footer-nav">{navLink(extras[0])}</nav>
        <div className="account-area">
          {accountOpen && <><button className="menu-dismiss" aria-label="Close account menu" onClick={() => setAccountOpen(false)}/><div className="account-menu"><div className="menu-heading">MY ACCOUNT</div><button onClick={() => navigate('settings')}><Settings2 size={16}/>Profile settings<ChevronRight size={14}/></button><button onClick={() => navigate('preferences')}><SlidersHorizontal size={16}/>Preferences<ChevronRight size={14}/></button><div className="menu-plan"><span><span className="status-dot"/>Personal workspace</span><Check size={14}/></div></div></>}
          <button className={`account-button ${accountOpen ? 'selected' : ''}`} onClick={() => setAccountOpen(v => !v)} aria-expanded={accountOpen} aria-label="Account settings" data-tooltip="Account settings"><span className="user-avatar"><UserRound size={18}/></span><span className="account-copy"><strong>Your account</strong><small>Personal workspace</small></span><Settings2 size={17} className="account-settings"/></button>
        </div>
      </div>
      <div className="sidebar-collapse"><button onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} data-tooltip={collapsed ? 'Expand sidebar' : undefined}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}<span>Collapse sidebar</span><span className="collapse-shortcut">‹</span></button></div>
    </aside>
    <div className="main-shell"><Starfield/><header className="topbar"><div className="breadcrumbs"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20}/></button><span className="breadcrumb-workspace">Workspace</span><ChevronRight size={13}/><span className="breadcrumb-current">{page.name}</span></div><span className="personal-badge"><span/>Personal workspace</span></header><main id="main-content" aria-label={`${page.name} page`}><div className="page-heading"><div className="page-eyebrow">YOUR WORKSPACE</div><h1>{page.name}</h1></div>{locked ? <div className="locked-preview"><h2>Job platforms</h2><div className="job-platform">Greenhouse</div><h2>Top job matches</h2><div className="feature-panel">Upload your resume to see matches.</div></div> : <Workspace page={page.id} resume={resume} saveResume={saveResume}/>}</main><footer className="main-footer"><span>Built for your next chapter.</span><span>JobBuddy AI <span className="footer-spark">✦</span></span></footer></div>
  </div>
  {locked && <div className="resume-gate">
    <section role="dialog" aria-modal="true" aria-labelledby="onboarding-title" tabIndex={-1} ref={element => element?.focus()}>
      <h1 id="onboarding-title">Welcome to JobBuddy AI</h1>
      <Workspace page="resume" resume={resume} saveResume={saveResume} locked />
    </section>
  </div>}
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
