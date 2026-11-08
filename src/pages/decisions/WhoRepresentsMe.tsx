import { Link } from 'react-router-dom';
import { members, links } from '../../lib/data';
import { Ext, Section } from '../../components/ui';
import { DistrictLookup } from '../roads/DistrictLookup';

export default function WhoRepresentsMe() {
  return (
    <>
      <p className="lede">Calloway County has four magistrate districts. Find yours, then see how your magistrate votes, what they have moved, and which road requests are open in your district.</p>
      <DistrictLookup />
      <Section title="The Fiscal Court" />
      <div className="grid cols-3">{members.map((m) => <Link key={m.id} to={`/decisions/members/${m.id}`} className="linkcard"><div className="eyebrow">{m.title}</div><h3>{m.full_name}</h3><p>Scorecard, motions, recorded votes ›</p></Link>)}</div>
      <p className="small muted" style={{ marginTop: 12 }}>Official contact details are on the county's <Ext href={links.officials}>elected officials page</Ext>; the county also publishes a <Ext href={links.districts}>magistrate district map</Ext>.</p>
    </>
  );
}
