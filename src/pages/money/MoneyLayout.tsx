import { Outlet } from 'react-router-dom';
import { SectionHero } from '../../components/ui';
import { Meta } from '../../components/Meta';
const TABS = [['/money', 'Overview'], ['/money/sources', 'Where it comes from'], ['/money/where-it-goes', 'Where it goes'], ['/money/budget-vs-actual', 'Budget vs. actual'], ['/money/lines', 'Line items'], ['/money/grants', 'Grants'], ['/money/debt', 'Debt']];
export default function MoneyLayout() {
  return (
    <>
      <Meta title="Money" description="Calloway County budget, revenue, spending, grants and debt, FY2018 to FY2027." />
      <SectionHero n={1} name="The Money" tone="amber" base="/money" tabs={TABS} label="Money sections"
        title={<>Follow the <span className="hl">money.</span></>}
        lede="Where Calloway County's money comes from and where it goes, FY2018 to FY2027. Audited and county-reported figures are labeled and never blended." />
      <Outlet />
    </>
  );
}
