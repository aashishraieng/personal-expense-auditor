import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import { useAuth } from "../hooks/useAuth";

function App() {
  const auth = useAuth();

  if (!auth.isAuthenticated) {
    return <Login onLogin={auth.login} />;
  }

  return <Dashboard onLogout={auth.logout} />;
}

export default App;
