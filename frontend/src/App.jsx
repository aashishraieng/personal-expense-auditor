import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Summary from "./pages/Summary";
import Settings from "./pages/Settings";
import AdminModel from "./pages/AdminModel";
import Login from "./pages/Login";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const auth = useAuth();

  if (!auth.isAuthenticated) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" />} />

      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/summary" element={<Summary />} />
      <Route path="/settings" element={<Settings />} />

      {/* ADMIN ONLY */}
      {auth.isAdmin && (
        <Route path="/admin/model" element={<AdminModel />} />
      )}

      {/* fallback */}
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}
