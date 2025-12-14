import { useState } from "react";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import Dashboard from "../pages/Dashboard";
import Settings from "../pages/Settings";
import { useAuth } from "../hooks/useAuth";

function App() {
  const auth = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (!auth.isAuthenticated) {
    if (showSignup) {
      return <Signup onBack={() => setShowSignup(false)} />;
    }

    return (
      <Login
        onLogin={auth.login}
        onSignup={() => setShowSignup(true)}
      />
    );
  }
  if (showSettings) {
    return (
      <Settings
        onBack={() => {
          setShowSettings(false);
        }}
      />
    );
  }


  return (
    <Dashboard
      onLogout={auth.logout}
      onOpenSettings={() => setShowSettings(true)}
    />
  );
}

export default App;
