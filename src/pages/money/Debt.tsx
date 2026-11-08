import { debt } from '../../lib/data';
import { usd } from '../../lib/format';
import { Section, SourceNote, Stat, Ext } from '../../components/ui';

export default function Debt() {
  return (
    <>
      <p className="lede">Calloway County has issued no bonds. Its debt is equipment financing for the Road Department. The one current loan was approved in April 2026; the older loans below have all reached their payoff dates.</p>
      <Section title="Current debt" />
      <div className="card accent">
        <div className="row between"><h3>{debt.current.purpose}</h3><span className="badge ok">Current</span></div>
        <div className="grid cols-4">
          <Stat label="Amount" value={usd(debt.current.orig)} /><Stat label="Rate" value={debt.current.rate} /><Stat label="Term" value={debt.current.term} /><Stat label="Lender" value={debt.current.lender} sub={`approved ${debt.current.date}`} />
        </div>
        <SourceNote><Ext href={debt.current.u}>Fiscal Court minutes, April 22, 2026</Ext></SourceNote>
      </div>
      <Section title={`Debt at the last independent audit (${debt.asOf})`} />
      <div className="card">
        <div className="grid cols-4"><Stat label="Total owed" value={usd(debt.total)} /><Stat label="Beginning of year" value={usd(debt.beginning)} /><Stat label="Paid that year" value={usd(debt.paid)} /><Stat label="Annual debt service" value={usd(debt.annualService)} sub="principal plus interest" /></div>
        <div className="table-wrap" style={{ marginTop: 12 }}><table className="data"><thead><tr><th>Loan</th><th>Purpose</th><th className="num">Original</th><th className="num">Balance {debt.asOf}</th><th className="num">Rate</th><th>Payoff</th></tr></thead>
          <tbody>{debt.items.map((d) => <tr key={d.n}><td>{d.n}</td><td className="small">{d.purpose}</td><td className="num">{usd(d.orig)}</td><td className="num">{usd(d.bal)}</td><td className="num">{d.rate}</td><td>{d.matures} <span className="badge">past</span></td></tr>)}</tbody></table></div>
        <p className="small muted" style={{ marginTop: 8 }}>All of these payoff dates have since passed, so these balances are no longer outstanding. They are shown for history, not as today's debt. {debt.retired.note}</p>
        <SourceNote>Calloway County Fiscal Court audit, Kentucky Auditor of Public Accounts, fiscal year ended June 30, 2021 (notes to the financial statements). Newer audits had not been published when this page was built.</SourceNote>
      </div>
    </>
  );
}
