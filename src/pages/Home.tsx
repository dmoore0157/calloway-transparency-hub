import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Meta } from '../components/Meta';
import { SearchBox } from '../components/Search';
import { DOORS } from '../components/Shell';
import { Section, Stat } from '../components/ui';
import { overview, meetings, motions, memberById } from '../lib/data';
import { usd, dateLong } from '../lib/format';
import { recordedVotes } from '../lib/analytics';
import { LiveTicketsStrip } from './roads/LiveTicketsStrip';

const QUESTIONS: [string, string][] = [
  ['How much did the county spend last year?', '/money'],
  ['What did the Fiscal Court decide at its last meeting?', '/decisions/meetings'],
  ['How did my magistrate vote?', '/decisions/members'],
  ['Where does my property tax go?', '/money/where-it-goes'],
  ['How do I report a pothole or washout?', '/roads/report'],
  ['Which promises have officials kept?', '/accountability'],
];

export default function Home() {
  const last = meetings[0];
  const lastMotions = motions.filter((m) => m.meeting_id === last.id && !m.is_routine);
  const split = recordedVotes().length;
  return (
    <>
      <Meta title="" description="Calloway County, Kentucky's budget, spending, Fiscal Court votes, road requests, and public records in plain English." />
      <div style={{ padding: '8px 0 4px' }}>
        <div className="eyebrow">Calloway County, Kentucky · Public records in plain English</div>
        <h1 style={{ marginTop: 6 }}>See where the money goes and how your leaders vote.</h1>
        <p className="lede" style={{ maxWidth: 680 }}>An independent, nonpartisan hub built from the county's own records: budgets, audits, and Fiscal Court minutes. Every number links to its source. Nothing is published that can't be checked.</p>
        <SearchBox big />
      </div>

      <Section title="Start with a question" />
      <div className="grid cols-2">
        {QUESTIONS.map(([q, to]) => <Link key={q} to={to} className="question"><span>{q}</span><ChevronRight size={18} color="var(--accent-ink)" /></Link>)}
      </div>

      <Section title="At a glance" />
      <div className="grid cols-4">
        <Stat label={`General Fund spending, FY${overview.stats.latestFY}`} value={usd(overview.stats.latestSpend, { compact: true })} sub={`${overview.stats.latestYoY > 0 ? '+' : ''}${overview.stats.latestYoY}% vs. the year before`} />
        <Stat label="Per resident" value={usd(overview.stats.latestPerRes)} sub={`General Fund ÷ ${overview.population.toLocaleString()} residents`} />
        <Stat label="Motions tracked" value={motions.length} sub={`${meetings.length} meetings since Nov 2021`} />
        <Stat label="Recorded or split votes" value={split} sub="Every other motion passed by voice, all ayes" />
      </div>

      <Section title="Explore the hub" />
      <div className="grid cols-3">
        {DOORS.map((d) => <Link key={d.to} to={d.to} className="linkcard"><div className="row" style={{ marginBottom: 6 }}><d.icon size={20} color="var(--accent-ink)" /><h3 style={{ margin: 0 }}>{d.label}</h3></div><p>{d.blurb}</p></Link>)}
        <Link to="/feedback" className="linkcard" style={{ borderTopColor: 'var(--accent)' }}><h3>Feedback</h3><p>Suggest a feature, request a dataset, or report an error. Votes decide what gets built next.</p></Link>
      </div>

      <Section title={`Last Fiscal Court meeting · ${dateLong(last.date)}`} action={<Link to={`/decisions/meetings/${last.id}`} className="small">Full meeting ›</Link>} />
      <div className="card accent">
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: 14 }}>{last.summary.slice(0, 5).map((b, i) => <li key={i}>{b}</li>)}</ul>
        <p className="small muted" style={{ margin: '10px 0 0' }}>{lastMotions.length} substantive motions{lastMotions.length ? `, moved most often by ${topMover(lastMotions.map((m) => m.mover))}` : ''}. <a href={last.minutes_url} target="_blank" rel="noopener noreferrer">Official minutes (PDF)</a></p>
      </div>

      <LiveTicketsStrip />

      <div className="card brand" style={{ marginTop: 24 }}>
        <h3>How this is built</h3>
        <p className="small" style={{ margin: 0 }}>Figures come from independent state audits (FY2018 to FY2021) and the county's own filings to the Kentucky Department for Local Government (FY2022 to FY2025), always labeled and never blended. The <Link to="/records/audits">state audits</Link> of FY2018 to FY2025 and every finding are summarized on their own page. Motions and votes are compiled from the official minutes and link to each PDF. Road tickets and ideas are submitted by residents and moderated before photos appear. <Link to="/records/about">Read the methodology</Link>.</p>
      </div>
    </>
  );
}

function topMover(ids: (string | null)[]) {
  const c: Record<string, number> = {}; for (const i of ids) if (i) c[i] = (c[i] ?? 0) + 1;
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return top ? memberById[top[0]].full_name : 'the court';
}
