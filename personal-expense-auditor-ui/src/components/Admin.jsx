import React, { useEffect, useState } from "react";

/**
 * Admin panel:
 * - tries GET /admin/users to verify admin privileges
 * - shows list of users (GET /admin/users)
 * - allows promote/create admin via POST /auth/grant-admin { email }
 * - allows starting retrain (POST /api/retrain) and reading retrain status (GET /api/retrain/status)
 *
 * Requires:
 * - a valid bearer token stored in localStorage under "paea_token" (same as App.jsx)
 * - API_BASE set to match your backend
 *
 * Usage: import and render inside your authenticated UI. You can also conditionally render
 * only when isAdmin === true (this component will self-check that).
 */

const API_BASE = "http://127.0.0.1:5000";

function authHeaders(token) {
  const h = { Accept: "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export default function Admin() {
  const token = window.localStorage.getItem("paea_token");
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");

  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [promoteMessage, setPromoteMessage] = useState("");

  const [retrainLoading, setRetrainLoading] = useState(false);
  const [retrainMessage, setRetrainMessage] = useState("");
  const [retrainStatus, setRetrainStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // check admin by calling GET /admin/users — returns 200 for admins, 403 for non-admins
  useEffect(() => {
    const check = async () => {
      if (!token) {
        setChecking(false);
        setIsAdmin(false);
        return;
      }
      setChecking(true);
      try {
        const res = await fetch(`${API_BASE}/admin/users`, {
          method: "GET",
          headers: authHeaders(token),
        });
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(true);
          setUsers(data.items || []);
        } else {
          setIsAdmin(false);
          if (res.status === 401) {
            setUsersError("Unauthorized — please login again.");
          } else if (res.status === 403) {
            setUsersError("You are not an admin.");
          } else {
            setUsersError(`Server returned ${res.status}`);
          }
        }
      } catch (err) {
        console.error("Admin check error", err);
        setIsAdmin(false);
        setUsersError("Network error while checking admin status.");
      } finally {
        setChecking(false);
      }
    };

    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // refresh users (admin-only)
  const fetchUsers = async () => {
    if (!token) return;
    setUsersLoading(true);
    setUsersError("");
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: authHeaders(token),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
      const data = await res.json();
      setUsers(data.items || []);
    } catch (err) {
      console.error("fetchUsers error", err);
      setUsersError("Failed to load users: " + (err.message || err));
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  // promote / create admin
  const handlePromote = async (e) => {
    e.preventDefault();
    setPromoteMessage("");
    if (!promoteEmail || !promoteEmail.includes("@")) {
      setPromoteMessage("Enter a valid email to promote.");
      return;
    }
    setPromoteLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/grant-admin`, {
        method: "POST",
        headers: {
          ...authHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: promoteEmail.trim().toLowerCase() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `status ${res.status}`);
      }

      // success: API returns created/promoted status
      const okStatus = data.status || "promoted";
      setPromoteMessage(`Success: ${okStatus} (${promoteEmail})`);
      setPromoteEmail("");
      // refresh user list
      await fetchUsers();
    } catch (err) {
      console.error("promote error", err);
      setPromoteMessage("Promote failed: " + (err.message || err));
    } finally {
      setPromoteLoading(false);
    }
  };

  // retrain control
  const startRetrain = async () => {
    if (!token) {
      setRetrainMessage("Please login first.");
      return;
    }
    setRetrainLoading(true);
    setRetrainMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/retrain`, {
        method: "POST",
        headers: authHeaders(token),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `status ${res.status}`);
      }
      setRetrainMessage("Retrain started. Polling status...");
      // fetch status once immediately
      await fetchRetrainStatus();
    } catch (err) {
      console.error("startRetrain error", err);
      setRetrainMessage("Failed to start retrain: " + (err.message || err));
    } finally {
      setRetrainLoading(false);
    }
  };

  // poll /api/retrain/status once
  const fetchRetrainStatus = async () => {
    if (!token) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/retrain/status`, {
        headers: authHeaders(token),
      });
      if (!res.ok) {
        // 404 -> never run
        if (res.status === 404) {
          setRetrainStatus({ status: "never_run" });
          return;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `status ${res.status}`);
      }
      const data = await res.json();
      setRetrainStatus(data);
    } catch (err) {
      console.error("fetchRetrainStatus error", err);
      setRetrainStatus({ error: err.message || String(err) });
    } finally {
      setStatusLoading(false);
    }
  };

  // convenience: copy token to clipboard (dev)
  const copyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      alert("Token copied to clipboard (useful for Postman).");
    } catch {
      alert("Clipboard failed. Token: " + token);
    }
  };

  if (checking) {
    return (
      <section className="card">
        <h2>Admin</h2>
        <p>Checking admin privileges…</p>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="card">
        <h2>Admin</h2>
        <div style={{ color: "#7f1d1d" }}>
          <p>You are not an admin (or your session expired).</p>
          {usersError && <p style={{ color: "#b91c1c" }}>{usersError}</p>}
          <p>If you should be admin, login with an admin account and try again.</p>
        </div>
      </section>
    );
  }

  // Admin UI
  return (
    <section className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Admin dashboard</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copyToken} className="small-btn">Copy token</button>
          <button onClick={fetchUsers} className="small-btn">Refresh users</button>
          <button onClick={fetchRetrainStatus} className="small-btn">Refresh retrain status</button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Users</h3>
        {usersLoading && <div className="info-banner">Loading users…</div>}
        {usersError && <div className="error-banner">{usersError}</div>}
        {!usersLoading && users.length === 0 && <p>No users found.</p>}
        {!usersLoading && users.length > 0 && (
          <table className="category-table" style={{ width: "100%", marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ width: 80 }}>ID</th>
                <th>Email</th>
                <th style={{ width: 180 }}>Created</th>
                <th style={{ width: 120 }}>Admin</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td style={{ wordBreak: "break-all" }}>{u.email}</td>
                  <td>{u.created_at || "-"}</td>
                  <td>{u.is_admin ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <hr style={{ margin: "16px 0" }} />

      <div>
        <h3>Promote user to admin</h3>
        <form onSubmit={handlePromote} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="email"
            placeholder="user@example.com"
            value={promoteEmail}
            onChange={e => setPromoteEmail(e.target.value)}
            style={{ padding: "6px 8px", minWidth: 260 }}
            required
          />
          <button type="submit" className="primary-btn" disabled={promoteLoading}>
            {promoteLoading ? "Working…" : "Promote"}
          </button>
        </form>
        {promoteMessage && <p style={{ marginTop: 8 }}>{promoteMessage}</p>}
      </div>

      <hr style={{ margin: "16px 0" }} />

      <div>
        <h3>Manual retrain (admin only)</h3>
        <p style={{ color: "#444" }}>
          Trigger server-side retraining of the category model. This runs your existing training script
          and may take a long time. Use only when you updated training data.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="primary-btn" onClick={startRetrain} disabled={retrainLoading}>
            {retrainLoading ? "Starting…" : "Start retrain"}
          </button>
          <button className="small-btn" onClick={fetchRetrainStatus} disabled={statusLoading}>
            {statusLoading ? "Checking…" : "Refresh status"}
          </button>
        </div>

        {retrainMessage && <p style={{ marginTop: 8 }}>{retrainMessage}</p>}

        {retrainStatus && (
          <div style={{ marginTop: 12, background: "#f8fafc", padding: 12, borderRadius: 8 }}>
            <div><strong>Status:</strong> {retrainStatus.status || retrainStatus.message || "unknown"}</div>
            {retrainStatus.started_at && <div><strong>Started:</strong> {retrainStatus.started_at}</div>}
            {retrainStatus.finished_at && <div><strong>Finished:</strong> {retrainStatus.finished_at}</div>}
            {retrainStatus.success !== undefined && (
              <div><strong>Success:</strong> {retrainStatus.success ? "yes" : "no"}</div>
            )}
            {retrainStatus.stdout && (
              <details style={{ marginTop: 8 }}>
                <summary>Stdout (truncated)</summary>
                <pre style={{ maxHeight: 250, overflow: "auto" }}>{retrainStatus.stdout}</pre>
              </details>
            )}
            {retrainStatus.stderr && (
              <details style={{ marginTop: 8 }}>
                <summary>Stderr (truncated)</summary>
                <pre style={{ maxHeight: 250, overflow: "auto", color: "#b91c1c" }}>{retrainStatus.stderr}</pre>
              </details>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
