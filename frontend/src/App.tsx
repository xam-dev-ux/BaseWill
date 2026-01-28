import { Routes, Route } from 'react-router-dom';
import Layout from './components/shared/Layout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import CreateWill from './pages/CreateWill';
import WillDetail from './pages/WillDetail';
import BeneficiaryView from './pages/BeneficiaryView';
import NotaryDashboard from './pages/NotaryDashboard';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<Landing />} />

      {/* Protected routes with layout */}
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create" element={<CreateWill />} />
        <Route path="/will/:id" element={<WillDetail />} />
        <Route path="/beneficiary" element={<BeneficiaryView />} />
        <Route path="/notary" element={<NotaryDashboard />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
