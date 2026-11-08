import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Landmark, Gavel, Construction, FolderOpen, MessageSquarePlus, Search, Menu, X, Users } from 'lucide-react';
import { SearchBox } from './Search';
import { recall, remember } from '../lib/device';

export const DOORS = [
  { to: '/money', label: 'Money', icon: Landmark, blurb: 'Budget, spending, revenue, grants, debt' },
  { to: '/decisions', label: 'Decisions', icon: Gavel, blurb: 'Meetings, votes, who represents you' },
  { to: '/roads', label: 'Roads', icon: Construction, blurb: 'Report a road problem and track it' },
  { to: '/leaders', label: 'Leaders', icon: Users, blurb: 'Profiles, promises, elections' },
  { to: '/records', label: 'Records', icon: FolderOpen, blurb: 'Audits, sources, glossary, downloads' },
];

export function Shell() {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const loc = useLocation();
  const [theme, setTheme] = useState<string>(() => recall('theme', 'auto'));
  useEffect(() => { setMenu(false); setSearch(false); window.scrollTo({ top: 0 }); }, [loc.pathname]);
  useEffect(() => { if (theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', theme); remember('theme', theme); }, [theme]);
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header style={{ background: 'var(--brand)', color: '#fff', position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="container row between" style={{ height: 'var(--header-h)', flexWrap: 'nowrap' }}>
          <Link to="/" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 17, whiteSpace: 'nowrap' }}>
            <span style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#1A2744', fontSize: 14 }}>CC</span>
            <span><span className="hide-sm">Calloway County </span>Transparency Hub</span>
          </Link>
          <nav className="desktop-nav" aria-label="Primary">
            {DOORS.map((d) => <NavLink key={d.to} to={d.to} className={({ isActive }) => (isActive ? 'active' : '')}>{d.label}</NavLink>)}
            <NavLink to="/feedback" className={({ isActive }) => (isActive ? 'active' : '')}>Feedback</NavLink>
          </nav>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <button className="iconbtn" aria-label="Search" onClick={() => { setSearch(!search); setMenu(false); }}><Search size={20} /></button>
            <button className="iconbtn mobile-only" aria-label="Menu" aria-expanded={menu} onClick={() => { setMenu(!menu); setSearch(false); }}>{menu ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
        {search && <div className="container" style={{ padding: '8px 16px 14px' }}><SearchBox autoFocus onDone={() => setSearch(false)} /></div>}
        {menu && (
          <div className="container mobile-menu">
            {DOORS.map((d) => <Link key={d.to} to={d.to}><d.icon size={18} /> <span><strong>{d.label}</strong><br /><span className="small" style={{ opacity: .8 }}>{d.blurb}</span></span></Link>)}
            <Link to="/feedback"><MessageSquarePlus size={18} /> <span><strong>Feedback</strong><br /><span className="small" style={{ opacity: .8 }}>Suggest an improvement or report an error</span></span></Link>
            <Link to="/records/about">About this hub</Link>
            <div className="row small" style={{ padding: '8px 0' }}>Theme: {['auto', 'light', 'dark'].map((t) => <button key={t} className={`chip ${theme === t ? 'active' : ''}`} onClick={() => setTheme(t)}>{t}</button>)}</div>
          </div>
        )}
      </header>
      <main id="main" className="page container"><Outlet /></main>
      <footer style={{ background: 'var(--brand)', color: '#D9D2C5', padding: '20px 0', fontSize: 12.5, marginBottom: 'var(--bottom-nav-h)' }} className="footer">
        <div className="container grid cols-3">
          <div><strong style={{ color: '#fff' }}>Independent and nonpartisan.</strong><br />Not affiliated with Calloway County government or any candidate. Every figure links to a public record. <Link to="/records/about" style={{ color: 'var(--accent)' }}>About and methodology</Link></div>
          <div><strong style={{ color: '#fff' }}>Found a mistake?</strong><br />Every page has a "Report an error" link. Corrections are logged publicly. <Link to="/records/corrections" style={{ color: 'var(--accent)' }}>Corrections log</Link></div>
          <div><strong style={{ color: '#fff' }}>Use the data.</strong><br />Downloads are CC BY 4.0. Source documents are public records of Calloway County and the Commonwealth of Kentucky. <Link to="/records/data" style={{ color: 'var(--accent)' }}>Data downloads</Link></div>
        </div>
      </footer>
      <nav className="bottom-nav" aria-label="Primary, mobile">
        {DOORS.map((d) => <NavLink key={d.to} to={d.to} className={({ isActive }) => (isActive ? 'active' : '')}><d.icon size={20} /><span>{d.label}</span></NavLink>)}
      </nav>
      <style>{`
        .iconbtn{background:transparent;border:none;color:#fff;padding:8px;border-radius:8px;cursor:pointer;display:inline-flex}
        .desktop-nav{display:none;gap:4px}
        .desktop-nav a{color:#E8E2D9;font-weight:600;font-size:14px;padding:8px 12px;border-radius:8px}
        .desktop-nav a.active{background:rgba(255,255,255,.12);color:#fff;box-shadow:inset 0 -3px 0 var(--accent)}
        .mobile-menu{display:grid;gap:4px;padding:6px 16px 14px}
        .mobile-menu a{display:flex;gap:12px;align-items:flex-start;color:#fff;padding:10px;border-radius:8px;background:rgba(255,255,255,.06)}
        .bottom-nav{position:fixed;bottom:0;left:0;right:0;z-index:40;display:flex;background:var(--surface);border-top:1px solid var(--line);padding-bottom:env(safe-area-inset-bottom)}
        .bottom-nav a{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px 6px;font-size:10.5px;font-weight:600;color:var(--ink-muted)}
        .bottom-nav a.active{color:var(--action)}
        .hide-sm{display:none}
        @media(min-width:768px){.desktop-nav{display:flex}.mobile-only,.bottom-nav{display:none}.footer{margin-bottom:0!important}.hide-sm{display:inline}}
      `}</style>
    </>
  );
}
