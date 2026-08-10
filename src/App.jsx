import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { SleeperProvider } from './context/SleeperContext';
import { Analytics } from '@vercel/analytics/react';

// Lazy load layouts and pages
const MainLayout = lazy(() => import('./layouts/MainLayout'));
const LeagueLayout = lazy(() => import('./layouts/LeagueLayout'));

const Home = lazy(() => import('./pages/Home'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LineupPage = lazy(() => import('./pages/LineupPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));

// Recap Feature
const RecapPage = lazy(() => import('./pages/RecapPage').catch(() => ({ default: () => <div>Page Not Found</div> })));

// Direction A pages
const MatchupPage = lazy(() => import('./pages/MatchupPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const StandingsPage = lazy(() => import('./pages/StandingsPage'));
const PlayerPage = lazy(() => import('./pages/PlayerPage'));

// Design system smoke test (atom library)
const DesignPreview = lazy(() => import('./pages/DesignPreview'));

// Loading fallback
const PageLoader = () => (
  <div className="flex h-[50vh] w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => {
  return (
    <SleeperProvider>
      <Analytics />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Home />} />

              {/* Design system preview (atom smoke test) — dev only */}
              {import.meta.env.DEV && <Route path="_design" element={<DesignPreview />} />}

              {/* League Routes */}
              <Route path="league/:leagueId" element={<LeagueLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="lineup" element={<LineupPage />} />
                <Route path="matchup" element={<MatchupPage />} />
                <Route path="matchup/:week" element={<MatchupPage />} />
                <Route path="standings" element={<StandingsPage />} />
                <Route path="team/:rosterId" element={<TeamPage />} />
                <Route path="player/:playerId" element={<PlayerPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="tools" element={<ToolsPage />} />
                <Route path="recap" element={<RecapPage />} />
              </Route>

              {/* Fallback for any unmatched routes */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </SleeperProvider>
  );
};

export default App;
