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

// Draft Feature
const DraftPage = lazy(() => import('./pages/DraftPage'));

// Recap Feature
const RecapPage = lazy(() => import('./pages/RecapPage').catch(() => ({ default: () => <div>Page Not Found</div> })));

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

              {/* League Routes */}
              <Route path="league/:leagueId" element={<LeagueLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="draft" element={<DraftPage />} />
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
