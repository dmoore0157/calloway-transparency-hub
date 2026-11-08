import { NavLink, Outlet } from 'react-router-dom';
import { Meta } from '../../components/Meta';
const TABS = [['/money', 'Overview'], ['/money/sources', 'Where it comes from'], ['/money/where-it-goes', 'Where it goes'], ['/money/budget-vs-actual', 'Budget vs. actual'], ['/money/lines', 'Line items'], ['/money/grants', 'Grants'], ['/money/debt', 'Debt']];
export default function MoneyLayout() {
  return (
    <>
      <Meta title="Money" description="Calloway County budget, revenue, spending, grants and debt, FY2018 to FY2027." />
      <div className="eyebrow">Money</div>
      <h1 style={{ marginTop: 4 }}>Where county money comes from and where it goes</h1>
      <nav className="subnav" aria-label="Money sections">{TABS.map(([to, l]) => <NavLink key={to} to={to} end={to === '/money'} className={({ isActive }) => (isActive ? 'active' : '')}>{l}</NavLink>)}</nav>
      <Outlet />
    </>
  );
}
