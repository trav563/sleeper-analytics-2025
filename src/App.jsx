import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SleeperProvider } from './context/SleeperContext';
import MainLayout from './layouts/MainLayout';
import LeagueLayout from './layouts/LeagueLayout';
import Home from './pages/Home';
import LineupPage from './pages/LineupPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HistoryPage from './pages/HistoryPage';
import ToolsPage from './pages/ToolsPage';

function App() {
  return (
    <SleeperProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="league/:leagueId" element={<LeagueLayout />}>
              <Route index element={<Navigate to="lineup" replace />} />
              <Route path="lineup" element={<LineupPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="tools" element={<ToolsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </SleeperProvider>
  );
}

export default App;
