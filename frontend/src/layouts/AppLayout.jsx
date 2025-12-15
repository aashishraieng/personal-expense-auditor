import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";


export default function AppLayout({ children }) {
    const auth = useAuth();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex bg-slate-950 text-slate-100">
            <aside className="w-64 bg-slate-900 p-6 border-r border-slate-800">
                <h1 className="text-xl font-bold mb-8">Expense Auditor</h1>

                <nav className="space-y-3 text-sm">
                    <NavLink to="/" className="block text-slate-400 hover:text-white">
                        Dashboard
                    </NavLink>
                    <NavLink to="/summary" className="block text-slate-400 hover:text-white">
                        Summary
                    </NavLink>
                    <NavLink to="/settings" className="block text-slate-400 hover:text-white">
                        Settings
                    </NavLink>

                    <button
                        onClick={() => {
                            auth.logout();
                            navigate("/login");
                        }}
                        className="block text-red-400 mt-6"
                    >
                        Logout
                    </button>
                </nav>
            </aside>

            <main className="flex-1 p-8">{children}</main>
        </div>
    );
}
