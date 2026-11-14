import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './layouts/DashboardLayout';
import CanteenDashboard from './pages/CanteenDashboard';
import AddSurplusFood from './pages/AddSurplusFood';
import MatchingDashboard from './pages/MatchingDashboard';
import NGOdashboard from './pages/NGOdashboard';
import VolunteerDashboard from './pages/VolunteerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Analytics from './pages/Analytics';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="canteen" replace />} />
        <Route path="canteen" element={<CanteenDashboard />} />
        <Route path="add-surplus" element={<AddSurplusFood />} />
        <Route path="matching" element={<MatchingDashboard />} />
        <Route path="ngo" element={<NGOdashboard />} />
        <Route path="volunteer" element={<VolunteerDashboard />} />
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
