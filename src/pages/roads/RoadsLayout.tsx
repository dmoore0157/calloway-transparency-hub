import { NavLink, Outlet } from 'react-router-dom';
import { Meta } from '../../components/Meta';
export default function RoadsLayout() {
  return (<>
    <Meta title="Roads" description="Report a Calloway County road problem, see every open request on a map, and track what happens." />
    <div className="eyebrow">Roads</div><h1 style={{ marginTop: 4 }}>Report a road problem and track every request</h1>
    <nav className="subnav" aria-label="Roads sections">{[['/roads', 'Map'], ['/roads/report', 'Report a problem'], ['/roads/list', 'All requests'], ['/roads/districts', 'By district']].map(([to, l]) => <NavLink key={to} to={to} end={to === '/roads'} className={({ isActive }) => (isActive ? 'active' : '')}>{l}</NavLink>)}</nav>
    <Outlet />
  </>);
}
