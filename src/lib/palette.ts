const read = (name: string, fallback: string) => (typeof document === 'undefined' ? fallback : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
export function palette() {
  return {
    series: [read('--series-1', '#1A2744'), read('--series-2', '#5B7A9E'), read('--series-3', '#6E8B5A'), read('--series-4', '#8C6BA0'), read('--series-5', '#3E7C8C'), read('--series-6', '#B45F1D'), '#C9A84C', '#8A6B1F'],
    src: { audited: read('--src-audited', '#1A2744'), county: read('--src-county', '#B45F1D'), yearend: read('--src-yearend', '#8C6BA0') } as Record<string, string>,
    ink: read('--ink', '#2C2C2C'), muted: read('--ink-muted', '#5E5B54'), line: read('--line', '#E3DCD0'), accent: read('--accent', '#C9A84C'), ok: read('--ok', '#2F6B3A'), bad: read('--bad', '#A8262D'), surface: read('--surface', '#fff'),
  };
}
export const tooltipStyle = () => ({ contentStyle: { background: palette().surface, border: `1px solid ${palette().line}`, borderRadius: 8, fontSize: 13, color: palette().ink }, labelStyle: { color: palette().ink, fontWeight: 700 } });
