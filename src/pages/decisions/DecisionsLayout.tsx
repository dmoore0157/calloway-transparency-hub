import { NavLink, Outlet } from 'react-router-dom';
import { Meta } from '../../components/Meta';
const TABS = [['/decisions', 'Overview'], ['/decisions/meetings', 'Meetings'], ['/decisions/votes', 'Vote tracker'], ['/decisions/members', 'Members & scorecards'], ['/decisions/ordinances', 'Ordinances'], ['/decisions/who-represents-me', 'Who represents me']];
export default function DecisionsLayout() {
  return (
    <>
      <Meta title="Decisions" description="Calloway County Fiscal Court meetings, motions, votes, member scorecards and ordinances." />
      <div className="eyebrow">Decisions</div>
      <h1 style={{ marginTop: 4 }}>What the Fiscal Court decided, and who moved it</h1>
      <nav className="subnav" aria-label="Decisions sections">{TABS.map(([to, l]) => <NavLink key={to} to={to} end={to === '/decisions'} className={({ isActive }) => (isActive ? 'active' : '')}>{l}</NavLink>)}</nav>
      <Outlet />
    </>
  );
}
