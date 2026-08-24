import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { SleeperProvider } from './context/SleeperContext';
import { Analytics } from '@vercel/analytics/react';

// Lazy load layouts and pages
const MainLayout = lazy(() => import('./layouts/MainLayout'));
const LeagueLayout = lazy(() => import('./layouts/LeagueLayout'));

const Home = lazy(() => import('./pages/Home'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));

// Recap Feature
const RecapPage = lazy(() => import('./pages/RecapPage').catch(() => ({ default: () => <div>Page Not Found</div> })));

// Direction A pages
const MatchupPage = lazy(() => import('./pages/MatchupPage'));
const MyTeamPage = lazy(() => import('./pages/MyTeamPage'));
const StandingsPage = lazy(() => import('./pages/StandingsPage'));
const PlayerPage = lazy(() => import('./pages/PlayerPage'));

// Design system smoke test (atom library)
const DesignPreview = lazy(() => import('./pages/DesignPreview'));

const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));

// Loading fallback
const PageLoader = () => (
  <div className="flex h-[50vh] w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

/**
 * Strip Sleeper identifiers out of analytics pathnames.
 *
 * Vercel Web Analytics auto-tracks `window.location.pathname`, and our routes
 * embed league / roster / player ids — so without this, every league a visitor
 * opens is recorded against their geo and user agent. We want to know which
 * FEATURES get used, not which leagues people looked at.
 */
export const redactAnalyticsUrl = (url) => {
    if (!url) return url;
    try {
        // `url` may be absolute or a bare path depending on SDK version.
        const isAbsolute = /^https?:\/\//i.test(url);
        const parsed = new URL(url, 'https://x.invalid');
        parsed.pathname = parsed.pathname
            .replace(/\/league\/\d+/g, '/league/[leagueId]')
            .replace(/\/team\/\d+/g, '/team/[rosterId]')
            .replace(/\/player\/[A-Za-z0-9]+/g, '/player/[playerId]')
            .replace(/\/matchup\/\d+/g, '/matchup/[week]');
        // Query strings can carry ids too; we never need them.
        parsed.search = '';
        return isAbsolute ? parsed.toString() : parsed.pathname;
    } catch {
        return url;
    }
};

const App = () => {
  return (
    <SleeperProvider>
      <Analytics beforeSend={(event) => ({ ...event, url: redactAnalyticsUrl(event.url) })} />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Home />} />
              <Route path="privacy" element={<PrivacyPage />} />

              {/* Design system preview (atom smoke test) — dev only */}
              {import.meta.env.DEV && <Route path="_design" element={<DesignPreview />} />}

              {/* League Routes */}
              <Route path="league/:leagueId" element={<LeagueLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="matchup" element={<MatchupPage />} />
                <Route path="matchup/:week" element={<MatchupPage />} />
                <Route path="standings" element={<StandingsPage />} />
                <Route path="my-team" element={<MyTeamPage />} />
                <Route path="team/:rosterId" element={<MyTeamPage />} />
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
