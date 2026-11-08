import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Landmark, Gavel, Construction, FolderOpen, MessageSquarePlus, Search, Menu, X, Users, Sparkles } from 'lucide-react';
import { SearchBox } from './Search';
import { recall, remember } from '../lib/device';
import { trackView } from '../lib/track';
import { checkForNewVersion } from '../lib/version';

export const DOORS = [
  { to: '/money', label: 'Money', chapter: 'The Money', icon: Landmark, blurb: 'Budget, spending, revenue, grants, debt' },
  { to: '/decisions', label: 'Decisions', chapter: 'The Decisions', icon: Gavel, blurb: 'Meetings, votes, who represents you' },
  { to: '/roads', label: 'Roads', chapter: 'The Roads', icon: Construction, blurb: 'Report a road problem and track it' },
  { to: '/leaders', label: 'Leaders', chapter: 'The Leaders', icon: Users, blurb: 'Profiles, promises, elections' },
  { to: '/records', label: 'Records', chapter: 'The Records', icon: FolderOpen, blurb: 'Audits, sources, glossary, downloads' },
];

export function Mark({ size = 32 }: { size?: number }) {
  return <span className="mark" style={size !== 32 ? { width: size, height: size } : undefined} aria-hidden="true"><svg viewBox="0 0 24 24" style={size !== 32 ? { width: size * 0.6, height: size * 0.6 } : undefined}><rect x="3" y="12" width="3.4" height="8" rx="1" /><rect x="8.2" y="7" width="3.4" height="13" rx="1" /><rect x="13.4" y="9.5" width="3.4" height="10.5" rx="1" /><rect x="18.6" y="4" width="3.4" height="16" rx="1" /></svg></span>;
}

export function Lockup() {
  return <Link to="/" className="lockup" aria-label="Calloway County Transparency Hub, home"><Mark /><span><span className="name">Calloway County</span><span className="tag">TRANSPARENCY HUB</span></span></Link>;
}

const THEMES = [['reel', 'Reel'], ['light', 'Light']] as const;

export function Shell() {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const loc = useLocation();
  const [theme, setTheme] = useState<string>(() => (recall<string>('theme', 'reel') === 'light' ? 'light' : 'reel'));
  useEffect(() => { setMenu(false); setSearch(false); window.scrollTo({ top: 0 }); trackView(loc.pathname); checkForNewVersion(loc.pathname); }, [loc.pathname]);
  useEffect(() => { if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light'); else document.documentElement.removeAttribute('data-theme'); remember('theme', theme); }, [theme]);
  const chapter = DOORS.findIndex((d) => loc.pathname === d.to || loc.pathname.startsWith(d.to + '/'));
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header on-dark">
        <div className="container row between" style={{ height: 'var(--header-h)', flexWrap: 'nowrap' }}>
          <Lockup />
          <nav className="desktop-nav" aria-label="Primary">
            {DOORS.map((d) => <NavLink key={d.to} to={d.to} className={({ isActive }) => (isActive ? 'active' : '')}>{d.label}</NavLink>)}
            <NavLink to="/feedback" className={({ isActive }) => (isActive ? 'active' : '')}>Feedback</NavLink>
          </nav>
          <div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}>
            <Link to="/ask" className="ask-btn" aria-label="Ask the records"><Sparkles size={16} /> <span className="hide-sm">Ask</span></Link>
            <button className="iconbtn" aria-label="Search" aria-expanded={search} onClick={() => { setSearch(!search); setMenu(false); }}><Search size={20} /></button>
            <button className="iconbtn mobile-only" aria-label="Menu" aria-expanded={menu} onClick={() => { setMenu(!menu); setSearch(false); }}>{menu ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
        {search && <div className="container" style={{ padding: '8px 16px 14px' }}><SearchBox autoFocus onDone={() => setSearch(false)} /></div>}
        {menu && (
          <div className="container mobile-menu">
            {DOORS.map((d) => <Link key={d.to} to={d.to}><d.icon size={18} /> <span><strong>{d.label}</strong><br /><span className="small" style={{ color: '#A9B6C8' }}>{d.blurb}</span></span></Link>)}
            <Link to="/ask"><Sparkles size={18} /> <span><strong>Ask the records</strong><br /><span className="small" style={{ color: '#A9B6C8' }}>Questions answered from the public record, with sources</span></span></Link>
            <Link to="/feedback"><MessageSquarePlus size={18} /> <span><strong>Feedback</strong><br /><span className="small" style={{ color: '#A9B6C8' }}>Suggest an improvement or report an error</span></span></Link>
            <Link to="/records/about"><FolderOpen size={18} /> <span><strong>About this hub</strong></span></Link>
            <div className="row small" style={{ padding: '8px 0' }}>Theme: {THEMES.map(([t, l]) => <button key={t} className={`chip ${theme === t ? 'active' : ''}`} aria-pressed={theme === t} onClick={() => setTheme(t)}>{l}</button>)}</div>
          </div>
        )}
      </header>
      <main id="main" className="page container"><Outlet /></main>
      <footer className="site-footer on-dark">
        <div className="container">
          <div className="footer-top">
            <Lockup />
            <div className="footer-slogan">No spin. Just the <span className="hl">records.</span></div>
            <div className="dots" aria-hidden="true">{DOORS.map((d, i) => <i key={d.to} className={i === chapter ? 'on' : ''} />)}</div>
          </div>
          <div className="grid cols-3">
            <div><strong>Independent and nonpartisan.</strong><br />Not affiliated with Calloway County government or any candidate. Every figure links to a public record. <Link to="/records/about">About and methodology</Link></div>
            <div><strong>Found a mistake?</strong><br />Every page has a "Report an error" link. Corrections are logged publicly. <Link to="/records/corrections">Corrections log</Link></div>
            <div><strong>Use the data.</strong><br />Downloads are CC BY 4.0. Source documents are public records of Calloway County and the Commonwealth of Kentucky. <Link to="/records/data">Data downloads</Link></div>
          </div>
          <div className="row small" style={{ marginTop: 16 }}>Theme: {THEMES.map(([t, l]) => <button key={t} className={`chip ${theme === t ? 'active' : ''}`} aria-pressed={theme === t} onClick={() => setTheme(t)}>{l}</button>)}</div>
        </div>
      </footer>
      <nav className="bottom-nav on-dark" aria-label="Primary, mobile">
        {DOORS.map((d) => <NavLink key={d.to} to={d.to} className={({ isActive }) => (isActive ? 'active' : '')}><d.icon size={20} /><span>{d.label}</span></NavLink>)}
      </nav>
    </>
  );
}
