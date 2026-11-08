// Chart colors come from the theme tokens on the document root (the light-card values, since charts sit on cards).
// The six series colors pass the dataviz validator (lightness band, chroma, color-blind and normal-vision separation);
// amber is 2.2:1 on a card, so it is always paired with a label or table. Slots 7 and 8 are neutral slates for "other".
const read = (name: string, fallback: string) => (typeof document === 'undefined' ? fallback : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
export function palette() {
  return {
    series: [read('--series-1', '#13A08C'), read('--series-2', '#E09A00'), read('--series-3', '#2F6FD6'), read('--series-4', '#D9497F'), read('--series-5', '#7357D9'), read('--series-6', '#5E8A1F'), '#6B7C93', '#A3B1C2'],
    src: { audited: read('--src-audited', '#13304E'), county: read('--src-county', '#E09A00'), yearend: read('--src-yearend', '#7357D9') } as Record<string, string>,
    ink: read('--ink', '#13304E'), muted: read('--ink-muted', '#4D5D73'), line: read('--line', '#D5DFEA'), accent: read('--accent', '#FCBA45'), ok: read('--ok', '#0B6B4F'), bad: read('--bad', '#B02A31'), surface: read('--surface', '#F4F7FB'),
  };
}
export const tooltipStyle = () => ({ contentStyle: { background: '#FFFFFF', border: `1px solid ${palette().line}`, borderRadius: 10, fontSize: 13, color: palette().ink, boxShadow: '0 6px 20px rgba(6,14,30,.18)' }, labelStyle: { color: palette().ink, fontWeight: 700 } });
