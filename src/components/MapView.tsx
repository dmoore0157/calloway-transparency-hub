import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
/** Dark basemaps to match the reel canvas, tried in order; falls back to the light style if none answers. */
const DARK_STYLES = ['https://tiles.openfreemap.org/styles/fiord', 'https://tiles.openfreemap.org/styles/dark'];
let chosen: Promise<string> | null = null;
export function mapStyle(): Promise<string> {
  if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light') return Promise.resolve(STYLE_URL);
  return (chosen ??= (async () => {
    for (const u of DARK_STYLES) { try { const r = await fetch(u); if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.layers)) return u; } } catch { /* try the next one */ } }
    return STYLE_URL;
  })());
}
export const COUNTY_CENTER: [number, number] = [-88.27, 36.62];
export const COUNTY_BOUNDS: [[number, number], [number, number]] = [[-88.55, 36.45], [-87.98, 36.80]];

// open requests amber, in county hands blue, fixed mint, closed slate (labels always accompany the colors)
export const STATUS_COLORS: Record<string, string> = { reported: '#FCBA45', submitted_to_county: '#E09A00', acknowledged: '#4A8DEB', in_progress: '#4A8DEB', fixed: '#5ED8C4', closed_not_county: '#9480EC', closed_duplicate: '#8796AA', closed_invalid: '#8796AA' };

export function useMap(container: React.RefObject<HTMLDivElement | null>, opts: { center?: [number, number]; zoom?: number; onReady?: (m: MLMap) => void; interactive?: boolean }) {
  const mapRef = useRef<MLMap | null>(null);
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    let cancelled = false; let m: MLMap | null = null;
    mapStyle().then((style) => {
      if (cancelled || !container.current) return;
      m = new maplibregl.Map({ container: container.current, style, center: opts.center ?? COUNTY_CENTER, zoom: opts.zoom ?? 10.3, maxBounds: [[-89.2, 36.0], [-87.4, 37.3]], attributionControl: { compact: true }, interactive: opts.interactive ?? true });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      if (opts.interactive !== false) m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'top-right');
      const ready = m; m.on('load', () => opts.onReady?.(ready));
      mapRef.current = m;
    });
    return () => { cancelled = true; m?.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return mapRef;
}

/** Adds (or replaces) a clustered ticket layer from GeoJSON. */
export function addTicketLayer(m: MLMap, fc: GeoJSON.FeatureCollection, onClick?: (props: Record<string, unknown>, lngLat: [number, number]) => void) {
  const src = m.getSource('tickets') as maplibregl.GeoJSONSource | undefined;
  if (src) { src.setData(fc); return; }
  m.addSource('tickets', { type: 'geojson', data: fc, cluster: true, clusterRadius: 40, clusterMaxZoom: 13 });
  m.addLayer({ id: 'clusters', type: 'circle', source: 'tickets', filter: ['has', 'point_count'], paint: { 'circle-color': '#13304E', 'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
  m.addLayer({ id: 'cluster-count', type: 'symbol', source: 'tickets', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#fff' } });
  m.addLayer({ id: 'points', type: 'circle', source: 'tickets', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 8, 'circle-color': (['match', ['get', 'status'], ...Object.entries(STATUS_COLORS).flat(), '#8796AA'] as unknown as maplibregl.DataDrivenPropertyValueSpecification<string>), 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
  m.on('click', 'clusters', (e) => { const f = m.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]; const id = f.properties?.cluster_id; (m.getSource('tickets') as maplibregl.GeoJSONSource).getClusterExpansionZoom(id).then((z) => m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z })); });
  m.on('click', 'points', (e) => { const f = e.features?.[0]; if (f && onClick) onClick(f.properties as Record<string, unknown>, (f.geometry as GeoJSON.Point).coordinates as [number, number]); });
  for (const l of ['clusters', 'points']) { m.on('mouseenter', l, () => (m.getCanvas().style.cursor = 'pointer')); m.on('mouseleave', l, () => (m.getCanvas().style.cursor = '')); }
}

export function MapLegend() {
  const items: [string, string][] = [['reported', 'Reported'], ['submitted_to_county', 'Sent to county'], ['acknowledged', 'Acknowledged / in progress'], ['fixed', 'Fixed'], ['closed_not_county', 'Not a county road']];
  return <div className="row small" style={{ marginTop: 8 }}>{items.map(([k, l]) => <span key={k}><span className="vote-dot" style={{ background: STATUS_COLORS[k] }} />{l}</span>)}</div>;
}
