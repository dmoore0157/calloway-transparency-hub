import { Link, Outlet } from 'react-router-dom';
import { SectionHero } from '../../components/ui';
import { Meta } from '../../components/Meta';
export default function RoadsLayout() {
  return (<>
    <Meta title="Roads" description="Report a Calloway County road problem, see every open request on a map, and track what happens." />
    <SectionHero n={3} name="The Roads" tone="amber" base="/roads" label="Roads sections" tabs={[['/roads', 'Map'], ['/roads/report', 'Report a problem'], ['/roads/list', 'All requests'], ['/roads/districts', 'By district']]}
      title={<>Fix it. <span className="hl">Track it.</span></>}
      lede={<>Report a pothole, washout or blocked culvert on a county road, then follow every request on the public map until it is fixed. <Link to="/roads/report" className="btn primary small" style={{ marginLeft: 6 }}>Report a problem</Link></>} />
    <Outlet />
  </>);
}
