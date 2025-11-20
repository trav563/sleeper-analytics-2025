import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import LeagueView from './pages/LeagueView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="league/:leagueId" element={<LeagueView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
