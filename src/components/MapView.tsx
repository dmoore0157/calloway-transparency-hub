import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const COUNTY_CENTER: [number, number] = [-88.27, 36.62];
export const COUNTY_BOUNDS: [[number, number], [number, number]] = [[-88.55, 36.45], [-87.98, 36.80]];

export const STATUS_COLORS: Record<string, string> = { reported: '#B45F1D', submitted_to_county: '#C9A84C', acknowledged: '#5B7A9E', in_progress: '#5B7A9E', fixed: '#2F6B3A', closed_not_county: '#8C6BA0', closed_duplicate: '#9A948A', closed_invalid: '#9A948A' };

export function useMap(container: React.RefObject<HTMLDivElement | null>, opts: { center?: [number, number]; zoom?: number; onReady?: (m: MLMap) => void; interactive?: boolean }) {
  const mapRef = useRef<MLMap | null>(null);
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const m = new maplibregl.Map({ container: container.current, style: STYLE_URL, center: opts.center ?? COUNTY_CENTER, zoom: opts.zoom ?? 10.3, maxBounds: [[-89.2, 36.0], [-87.4, 37.3]], attributionControl: { compact: true }, interactive: opts.interactive ?? true });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    if (opts.interactive !== false) m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'top-right');
    m.on('load', () => opts.onReady?.(m));
    mapRef.current = m;
    return () => { m.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return mapRef;
}

/** Adds (or replaces) a clustered ticket layer from GeoJSON. */
export function addTicketLayer(m: MLMap, fc: GeoJSON.FeatureCollection, onClick?: (props: Record<string, unknown>, lngLat: [number, number]) => void) {
  const src = m.getSource('tickets') as maplibregl.GeoJSONSource | undefined;
  if (src) { src.setData(fc); return; }
  m.addSource('tickets', { type: 'geojson', data: fc, cluster: true, clusterRadius: 40, clusterMaxZoom: 13 });
  m.addLayer({ id: 'clusters', type: 'circle', source: 'tickets', filter: ['has', 'point_count'], paint: { 'circle-color': '#1A2744', 'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
  m.addLayer({ id: 'cluster-count', type: 'symbol', source: 'tickets', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#fff' } });
  m.addLayer({ id: 'points', type: 'circle', source: 'tickets', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 8, 'circle-color': (['match', ['get', 'status'], ...Object.entries(STATUS_COLORS).flat(), '#9A948A'] as unknown as maplibregl.DataDrivenPropertyValueSpecification<string>), 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
  m.on('click', 'clusters', (e) => { const f = m.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]; const id = f.properties?.cluster_id; (m.getSource('tickets') as maplibregl.GeoJSONSource).getClusterExpansionZoom(id).then((z) => m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z })); });
  m.on('click', 'points', (e) => { const f = e.features?.[0]; if (f && onClick) onClick(f.properties as Record<string, unknown>, (f.geometry as GeoJSON.Point).coordinates as [number, number]); });
  for (const l of ['clusters', 'points']) { m.on('mouseenter', l, () => (m.getCanvas().style.cursor = 'pointer')); m.on('mouseleave', l, () => (m.getCanvas().style.cursor = '')); }
}

export function MapLegend() {
  const items: [string, string][] = [['reported', 'Reported'], ['submitted_to_county', 'Sent to county'], ['acknowledged', 'Acknowledged / in progress'], ['fixed', 'Fixed'], ['closed_not_county', 'Not a county road']];
  return <div className="row small" style={{ marginTop: 8 }}>{items.map(([k, l]) => <span key={k}><span className="vote-dot" style={{ background: STATUS_COLORS[k] }} />{l}</span>)}</div>;
}
