// Renders the hub's social cards (1200x630, one per chapter) and app icons into public/ using the bundled Inter font.
// Run after changing the brand: node scripts/make-brand.cjs   (needs Playwright's Chromium; output is committed)
const fs = require('node:fs'); const path = require('node:path');
const { chromium } = require('playwright');
const font = path.resolve('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2');
const MARK = '<svg viewBox="0 0 24 24"><rect x="3" y="12" width="3.4" height="8" rx="1"/><rect x="8.2" y="7" width="3.4" height="13" rx="1"/><rect x="13.4" y="9.5" width="3.4" height="10.5" rx="1"/><rect x="18.6" y="4" width="3.4" height="16" rx="1"/></svg>';
const CARDS = [
  ['home', '', 'Calloway County, Kentucky', 'amber', 'No spin.<br>Just the <b>records.</b>', 'Budgets, votes, audits, roads and leaders, every figure linked to its public record.'],
  ['money', '01', 'The Money', 'amber', 'Follow the<br><b>money.</b>', 'Where county money comes from and where it goes, FY2018 to FY2027.'],
  ['decisions', '02', 'The Decisions', 'mint', 'See how they<br><b>voted.</b>', 'Every Fiscal Court motion, who moved it and how members voted.'],
  ['roads', '03', 'The Roads', 'amber', 'Fix it.<br><b>Track it.</b>', 'Report a county road problem and follow every request on a public map.'],
  ['leaders', '04', 'The Leaders', 'mint', 'Beyond the<br><b>slogans.</b>', 'Votes, promises, audits and elections, every official measured by the same rules.'],
  ['records', '05', 'The Records', 'amber', 'Sourced. Checkable.<br><b>Public.</b>', 'State audits, county filings, budgets and minutes behind every number.'],
  ['ask', '', 'Ask the records', 'mint', 'Ask the<br><b>records.</b>', 'Questions answered only from the public record, with every source linked.'],
];
const css = `@font-face{font-family:Inter;src:url(file://${font}) format('woff2');font-weight:100 900}
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;overflow:hidden;font-family:Inter;color:#F0F0F6;position:relative;
background:repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 1px,transparent 1px 84px),repeating-linear-gradient(80deg,rgba(255,255,255,.07) 0 1px,transparent 1px 88px),linear-gradient(170deg,#22242F 0%,#18243C 60%)}
.arc{position:absolute;border-radius:50%;border:3px solid #FCBA45}.a1{width:760px;height:760px;right:-420px;top:-60px}.a2{width:500px;height:500px;right:-300px;top:70px;border-color:#5ED8C4}
.wrap{position:absolute;left:72px;top:64px;right:72px;bottom:56px;display:flex;flex-direction:column}
.pill{align-self:flex-start;background:#FCBA45;color:#13304E;font-weight:800;font-size:20px;letter-spacing:.12em;text-transform:uppercase;padding:9px 20px;border-radius:999px}.pill.mint{background:#5ED8C4}.pill i{font-style:normal;opacity:.7;margin-right:10px}
h1{font-weight:900;text-transform:uppercase;letter-spacing:-.025em;line-height:.96;font-size:104px;margin-top:30px}h1 b{color:#FCBA45}.mint h1 b{color:#5ED8C4}
p{font-size:27px;color:#A9B6C8;margin-top:22px;max-width:860px;line-height:1.35}
.foot{margin-top:auto;display:flex;align-items:center;gap:16px}.mark{width:56px;height:56px;border-radius:50%;background:#FCBA45;display:flex;align-items:center;justify-content:center}.mark svg{width:34px;height:34px;fill:#13304E}
.n{font-weight:850;font-size:26px;line-height:1.05}.t{font-weight:800;font-size:15px;letter-spacing:.2em;color:#5ED8C4;margin-top:4px}.url{margin-left:auto;font-size:20px;color:#A9B6C8;font-weight:600}`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  fs.mkdirSync('public/og', { recursive: true });
  for (const [id, n, name, tone, title, lede] of CARDS) {
    await p.setContent(`<html><head><style>${css}</style></head><body class="${tone}"><span class="arc a1"></span><span class="arc a2"></span><div class="wrap ${tone}"><span class="pill ${tone === 'mint' ? 'mint' : ''}">${n ? `<i>${n}</i>` : ''}${name}</span><h1>${title}</h1><p>${lede}</p><div class="foot"><span class="mark">${MARK}</span><span><div class="n">Calloway County</div><div class="t">TRANSPARENCY HUB</div></span><span class="url">Independent · Nonpartisan · Sourced</span></div></div></body></html>`, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `public/og/${id}.png` });
  }
  for (const s of [192, 512]) {
    await p.setViewportSize({ width: s, height: s });
    await p.setContent(`<html><body style="margin:0;width:${s}px;height:${s}px;background:#18243C;display:flex;align-items:center;justify-content:center"><div style="width:${s * 0.8}px;height:${s * 0.8}px;border-radius:50%;background:#FCBA45;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:${s * 0.48}px;height:${s * 0.48}px;fill:#13304E">${MARK.replace(/<\/?svg[^>]*>/g, '')}</svg></div></body></html>`);
    await p.screenshot({ path: `public/icon-${s}.png` });
  }
  await b.close(); console.log('brand assets written');
})();
