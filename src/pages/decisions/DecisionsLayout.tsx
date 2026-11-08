import { Outlet } from 'react-router-dom';
import { SectionHero } from '../../components/ui';
import { Meta } from '../../components/Meta';
const TABS = [['/decisions', 'Overview'], ['/decisions/meetings', 'Meetings'], ['/decisions/votes', 'Vote tracker'], ['/decisions/members', 'Members & scorecards'], ['/decisions/ordinances', 'Ordinances'], ['/decisions/who-represents-me', 'Who represents me']];
export default function DecisionsLayout() {
  return (
    <>
      <Meta title="Decisions" description="Calloway County Fiscal Court meetings, motions, votes, member scorecards and ordinances." />
      <SectionHero n={2} name="The Decisions" tone="mint" base="/decisions" tabs={TABS} label="Decisions sections"
        title={<>See how they <span className="hl">voted.</span></>}
        lede="What the Calloway County Fiscal Court decided, who moved and seconded it, and how each member voted, from the official minutes." />
      <Outlet />
    </>
  );
}
