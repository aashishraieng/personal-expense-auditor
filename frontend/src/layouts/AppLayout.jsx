import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function AppLayout({ children }) {
    const auth = useAuth();

    return (
        <div className="min-h-screen flex bg-slate-950 text-slate-100">
            <aside className="w-64 p-6 border-r border-slate-800">
                <h1 className="text-xl font-bold mb-6">Expense Auditor</h1>

                <nav className="space-y-3 text-sm">
                    <NavLink to="/dashboard" className="block text-slate-300 hover:text-white">
                        Dashboard
                    </NavLink>

                    <NavLink to="/summary" className="block text-slate-300 hover:text-white">
                        Summary
                    </NavLink>

                    <NavLink to="/settings" className="block text-slate-300 hover:text-white">
                        Settings
                    </NavLink>

                    {auth.isAdmin && (
                        <NavLink
                            to="/admin/model"
                            className="block text-emerald-400 hover:text-emerald-300"
                        >
                            Model
                        </NavLink>
                    )}
                </nav>
            </aside>

            <main className="flex-1 p-8">{children}</main>
        </div>
    );
}
