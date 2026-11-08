import { links } from '../../lib/data';
import { Ext } from '../../components/ui';

/** Address → district lookup needs the magistrate district boundaries (GeoJSON) which the hub has not yet obtained. */
export function DistrictLookup() {
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ fontSize: 16 }}>Which district am I in?</h3>
      <p className="small">The county publishes a <Ext href={links.districts}>magistrate district map</Ext>. The hub will offer an address lookup as soon as the district boundaries are available as map data; that request is on the <a href={`${import.meta.env.BASE_URL}feedback`}>feedback board</a>.</p>
    </div>
  );
}
