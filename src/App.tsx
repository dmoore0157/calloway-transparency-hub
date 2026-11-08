import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/Shell';
import { ExplainProvider } from './components/Explain';
import Home from './pages/Home';
import MoneyLayout from './pages/money/MoneyLayout';
import MoneyOverview from './pages/money/Overview';
import Sources from './pages/money/Sources';
import WhereItGoes from './pages/money/WhereItGoes';
import BudgetVsActual from './pages/money/BudgetVsActual';
import Lines, { LinePage } from './pages/money/Lines';
import Grants from './pages/money/Grants';
import Debt from './pages/money/Debt';
import DecisionsLayout from './pages/decisions/DecisionsLayout';
import DecisionsOverview from './pages/decisions/Overview';
import Meetings, { MeetingPage } from './pages/decisions/Meetings';
import Votes, { MotionPage } from './pages/decisions/Votes';
import Members, { MemberPage } from './pages/decisions/Members';
import Ordinances from './pages/decisions/Ordinances';
import WhoRepresentsMe from './pages/decisions/WhoRepresentsMe';
import { RecordsLayout, Reports, Sources as RecordSources, Glossary, DataDownloads, Corrections, About } from './pages/records/Records';
import { Audits, AuditPage } from './pages/records/Audits';
import Feedback, { IdeaPage } from './pages/feedback/Feedback';
import { AccountabilityLayout, Scoreboard, AllCommitments, MemberCommitments, CommitmentPage, Methodology } from './pages/accountability/Accountability';

const RoadsLayout = lazy(() => import('./pages/roads/RoadsLayout'));
const TicketMap = lazy(() => import('./pages/roads/TicketMap'));
const TicketList = lazy(() => import('./pages/roads/TicketList'));
const Districts = lazy(() => import('./pages/roads/Districts'));
const Report = lazy(() => import('./pages/roads/Report'));
const TicketPage = lazy(() => import('./pages/roads/TicketPage'));
const Admin = lazy(() => import('./pages/admin/Admin').then((m) => ({ default: m.AdminLayout })));
const AdminOverview = lazy(() => import('./pages/admin/Admin').then((m) => ({ default: m.AdminOverview })));
const AdminPhotos = lazy(() => import('./pages/admin/Admin').then((m) => ({ default: m.AdminPhotos })));
const AdminTickets = lazy(() => import('./pages/admin/Admin').then((m) => ({ default: m.AdminTickets })));
const AdminIdeas = lazy(() => import('./pages/admin/Admin').then((m) => ({ default: m.AdminIdeas })));
const AdminFlags = lazy(() => import('./pages/admin/Admin').then((m) => ({ default: m.AdminFlags })));
const AdminCommitments = lazy(() => import('./pages/admin/Admin').then((m) => ({ default: m.AdminCommitments })));

const Loading = () => <p className="muted" style={{ padding: 24 }}>Loading…</p>;

export default function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return (
    <BrowserRouter basename={base}>
      <ExplainProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Home />} />
              <Route path="money" element={<MoneyLayout />}>
                <Route index element={<MoneyOverview />} /><Route path="sources" element={<Sources />} /><Route path="where-it-goes" element={<WhereItGoes />} /><Route path="budget-vs-actual" element={<BudgetVsActual />} />
                <Route path="lines" element={<Lines />} /><Route path="lines/:account" element={<LinePage />} /><Route path="grants" element={<Grants />} /><Route path="debt" element={<Debt />} />
              </Route>
              <Route path="decisions" element={<DecisionsLayout />}>
                <Route index element={<DecisionsOverview />} /><Route path="meetings" element={<Meetings />} /><Route path="meetings/:id" element={<MeetingPage />} />
                <Route path="votes" element={<Votes />} /><Route path="motions/:id" element={<MotionPage />} /><Route path="members" element={<Members />} /><Route path="members/:id" element={<MemberPage />} />
                <Route path="ordinances" element={<Ordinances />} /><Route path="who-represents-me" element={<WhoRepresentsMe />} />
              </Route>
              <Route path="roads" element={<RoadsLayout />}>
                <Route index element={<TicketMap />} /><Route path="report" element={<Report />} /><Route path="list" element={<TicketList />} /><Route path="districts" element={<Districts />} /><Route path="tickets/:id" element={<TicketPage />} />
              </Route>
              <Route path="accountability" element={<AccountabilityLayout />}>
                <Route index element={<Scoreboard />} /><Route path="all" element={<AllCommitments />} /><Route path="methodology" element={<Methodology />} /><Route path="commitments/:id" element={<CommitmentPage />} /><Route path=":memberId" element={<MemberCommitments />} />
              </Route>
              <Route path="records" element={<RecordsLayout />}>
                <Route index element={<Reports />} /><Route path="audits" element={<Audits />} /><Route path="audits/:fy" element={<AuditPage />} /><Route path="sources" element={<RecordSources />} /><Route path="glossary" element={<Glossary />} /><Route path="data" element={<DataDownloads />} /><Route path="corrections" element={<Corrections />} /><Route path="about" element={<About />} />
              </Route>
              <Route path="feedback" element={<Feedback />} /><Route path="feedback/ideas/:id" element={<IdeaPage />} />
              <Route path="admin" element={<Admin />}>
                <Route index element={<AdminOverview />} /><Route path="photos" element={<AdminPhotos />} /><Route path="tickets" element={<AdminTickets />} /><Route path="ideas" element={<AdminIdeas />} /><Route path="flags" element={<AdminFlags />} /><Route path="commitments" element={<AdminCommitments />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ExplainProvider>
    </BrowserRouter>
  );
}
