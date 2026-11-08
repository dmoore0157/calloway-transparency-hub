export const usd = (n: number, opts: { compact?: boolean; cents?: boolean } = {}) => {
  if (opts.compact) {
    const abs = Math.abs(n);
    if (abs >= 1e6) return (n < 0 ? '-' : '') + '$' + (abs / 1e6).toFixed(abs >= 1e7 ? 0 : 2).replace(/\.?0+$/, '') + 'M';
    if (abs >= 1e3) return (n < 0 ? '-' : '') + '$' + Math.round(abs / 1e3) + 'K';
  }
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: opts.cents ? 2 : 0, minimumFractionDigits: opts.cents ? 2 : 0 });
};
export const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;
export const num = (n: number) => n.toLocaleString('en-US');
export const fy = (y: number) => `FY${y}`;
export const fyLong = (y: number) => `FY${y - 1}-${String(y).slice(2)}`;
export const dateLong = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
export const dateShort = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
export const relTime = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 864e5;
  if (d < 1) return 'today'; if (d < 2) return 'yesterday'; if (d < 30) return `${Math.floor(d)} days ago`; if (d < 365) return `${Math.floor(d / 30)} months ago`; return `${Math.floor(d / 365)} years ago`;
};
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
