import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BriefcaseBusiness, FileText, UserRound, Layers, PanelLeftClose, PanelLeftOpen, ChevronDown, ChevronRight, CreditCard, Sparkles, ArrowUpRight, Settings2, SlidersHorizontal, Menu, X, Check } from 'lucide-react';
import './styles.css';

const pages = [
  { id: 'jobs', name: 'Jobs', icon: BriefcaseBusiness },
  { id: 'resume', name: 'Resume', icon: FileText },
  { id: 'profile', name: 'Profile', icon: UserRound },
  { id: 'applications', name: 'Application Status', icon: Layers },
];
const extras = [{ id: 'billing', name: 'Billing / Credits', icon: CreditCard }, { id: 'settings', name: 'Profile settings', icon: Settings2 }, { id: 'preferences', name: 'Preferences', icon: SlidersHorizontal }];
const getPage = () => [...pages, ...extras].find(p => p.id === location.hash.slice(1)) || pages[0];
// Fixed coordinates keep the sky stable across page changes and sidebar toggles.
const stars = Array.from({ length: 220 }, (_, i) => ({
  left: `${((i * 613 + 17) % 997) / 10}%`,
  top: `${((i * 317 + 43) % 991) / 10}%`,
  '--star-size': `${i % 11 === 0 ? 3 : i % 3 === 0 ? 2 : 1.2}px`,
  '--star-opacity': 0.4 + (i % 5) * 0.14,
  '--star-color': ['#e9dcff', '#8ddcff', '#ffb5df', '#ffe0a0', '#b4b9ff'][i % 5],
  '--twinkle-duration': `${4 + i % 7}s`,
  animationDelay: `${-(i % 11)}s`,
}));
function Starfield({ sidebar = false }) {
  return <div className={`cosmic-background ${sidebar ? 'sidebar-sky' : ''}`} aria-hidden="true">
    <div className="nebula nebula-violet"/><div className="nebula nebula-blue"/><div className="nebula nebula-rose"/>
    <div className="starfield">{(sidebar ? stars.slice(35, 105) : stars).map((style, i) => <span key={i} className={`star ${i % 9 === 0 ? 'star-bright' : ''}`} style={style}/>)}</div>
    <div className="shooting-star shooting-star-one"/><div className="shooting-star shooting-star-two"/><div className="shooting-star shooting-star-three"/>
  </div>;
}
function App() {
  const [page, setPage] = useState(getPage);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('jobbuddy-sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => { const update = () => { setPage(getPage()); setMobileOpen(false); setAccountOpen(false); }; window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  useEffect(() => { document.title = `${page.name} · JobBuddy AI`; }, [page]);
  useEffect(() => { const close = e => { if(e.key === 'Escape') { setAccountOpen(false); setMobileOpen(false); } }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  const toggle = () => setCollapsed(v => { localStorage.setItem('jobbuddy-sidebar', v ? 'expanded' : 'collapsed'); return !v; });
  const navigate = id => { location.hash = id; setMobileOpen(false); setAccountOpen(false); };
  const navLink = p => <a key={p.id} href={`#${p.id}`} className={`nav-link ${page.id === p.id ? 'active' : ''}`} aria-current={page.id === p.id ? 'page' : undefined} data-tooltip={p.name} onClick={() => { setMobileOpen(false); setAccountOpen(false); }}><p.icon size={19}/><span className="nav-label">{p.name}</span>{page.id === p.id && <span className="active-dot"/>}</a>;
  return <div className={`app ${collapsed ? 'is-collapsed' : ''}`}>
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation"/>}
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Main navigation"><Starfield sidebar/>
      <div className="brand-row"><a className="brand" href="#jobs" aria-label="JobBuddy AI home"><span className="brand-symbol"><BriefcaseBusiness size={20} strokeWidth={1.8}/><span className="brand-spark">✦</span></span><span className="brand-name">JobBuddy <span>AI</span></span></a><button className="mobile-close icon-button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18}/></button></div>
      <button className="workspace" data-tooltip="Personal workspace" onClick={() => navigate('profile')}><span className="workspace-avatar">J<span/></span><span className="workspace-label"><strong>My workspace</strong><small>Personal account</small></span><ChevronDown size={14} className="workspace-chevron"/></button>
      <div className="nav-section"><div className="section-label">WORKSPACE</div><nav>{pages.map(navLink)}</nav></div>
      <div className="sidebar-bottom">
        <div className="credit-card" data-tooltip="Credits: not connected"><div className="credit-heading"><span className="credit-icon"><Sparkles size={15}/></span><span className="credit-title">Your credits</span><span className="plan-label">FREE</span></div><div className="credit-balance"><strong>—</strong><span>credits available</span></div><div className="credit-meter"><span/></div><div className="credit-note">Your balance will appear here</div><button className="upgrade-button" onClick={() => navigate('billing')}><span>Manage credits</span><ArrowUpRight size={15}/></button></div>
        <nav className="footer-nav">{navLink(extras[0])}</nav>
        <div className="account-area">
          {accountOpen && <><button className="menu-dismiss" aria-label="Close account menu" onClick={() => setAccountOpen(false)}/><div className="account-menu"><div className="menu-heading">MY ACCOUNT</div><button onClick={() => navigate('settings')}><Settings2 size={16}/>Profile settings<ChevronRight size={14}/></button><button onClick={() => navigate('preferences')}><SlidersHorizontal size={16}/>Preferences<ChevronRight size={14}/></button><div className="menu-plan"><span><span className="status-dot"/>Personal workspace</span><Check size={14}/></div></div></>}
          <button className={`account-button ${accountOpen ? 'selected' : ''}`} onClick={() => setAccountOpen(v => !v)} aria-expanded={accountOpen} aria-label="Account settings" data-tooltip="Account settings"><span className="user-avatar"><UserRound size={18}/></span><span className="account-copy"><strong>Your account</strong><small>Personal workspace</small></span><Settings2 size={17} className="account-settings"/></button>
        </div>
      </div>
      <div className="sidebar-collapse"><button onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} data-tooltip={collapsed ? 'Expand sidebar' : undefined}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}<span>Collapse sidebar</span><span className="collapse-shortcut">‹</span></button></div>
    </aside>
    <div className="main-shell"><Starfield/><header className="topbar"><div className="breadcrumbs"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20}/></button><span className="breadcrumb-workspace">Workspace</span><ChevronRight size={13}/><span className="breadcrumb-current">{page.name}</span></div><span className="personal-badge"><span/>Personal workspace</span></header><main id="main-content" key={page.id} aria-label={`${page.name} page`}><div className="page-heading"><div className="page-eyebrow">YOUR WORKSPACE</div><h1>{page.name}</h1></div><div className="blank-page" aria-hidden="true"/></main><footer className="main-footer"><span>Built for your next chapter.</span><span>JobBuddy AI <span className="footer-spark">✦</span></span></footer></div>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
