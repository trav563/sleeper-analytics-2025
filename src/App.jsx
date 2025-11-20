import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SleeperProvider } from './context/SleeperContext';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import LeagueView from './pages/LeagueView';

function App() {
  return (
    <SleeperProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="league/:leagueId" element={<LeagueView />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SleeperProvider>
  );
}

export default App;
