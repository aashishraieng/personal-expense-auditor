import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
    Squares2X2Icon,
    ChartBarIcon,
    Cog6ToothIcon,
    CpuChipIcon,
    ArrowLeftOnRectangleIcon
} from "@heroicons/react/24/outline";

export default function AppLayout({ children }) {
    const auth = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("token");
        window.location.href = "/";
    };

    const navItems = [
        { name: "Dashboard", to: "/dashboard", icon: Squares2X2Icon },
        { name: "Summary", to: "/summary", icon: ChartBarIcon },
        { name: "Settings", to: "/settings", icon: Cog6ToothIcon },
    ];

    return (
        <div className="min-h-screen flex bg-[#020617] text-slate-100 font-sans">
            {/* Sidebar */}
            <aside className="w-72 flex flex-col border-r border-slate-800/60 bg-slate-950/50 backdrop-blur-xl sticky top-0 h-screen">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <ChartBarIcon className="h-6 w-6 text-white" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            Expense Auditor
                        </h1>
                    </div>

                    <nav className="space-y-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.to}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                        ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-inner"
                                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/40"
                                    }`
                                }
                            >
                                <item.icon className="h-5 w-5" />
                                <span className="font-medium">{item.name}</span>
                            </NavLink>
                        ))}

                        {auth.isAdmin && (
                            <div className="pt-6 mt-6 border-t border-slate-800/60">
                                <p className="px-4 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Admin Panel</p>
                                <NavLink
                                    to="/admin/model"
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                            : "text-emerald-500/60 hover:text-emerald-400 hover:bg-emerald-500/5"
                                        }`
                                    }
                                >
                                    <CpuChipIcon className="h-5 w-5" />
                                    <span className="font-medium">Model Intelligence</span>
                                </NavLink>
                            </div>
                        )}
                    </nav>
                </div>

                {/* Footer / User Profile */}
                <div className="mt-auto p-6 border-t border-slate-800/60 bg-slate-950/20">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 transition-all duration-200"
                    >
                        <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative">
                {/* Subtle Background Blobs for depth */}
                <div className="absolute top-0 right-0 -z-10 h-[500px] w-[500px] bg-indigo-500/5 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-0 left-0 -z-10 h-[400px] w-[400px] bg-emerald-500/5 blur-[100px] rounded-full"></div>

                <header className="h-16 border-b border-slate-800/40 flex items-center justify-end px-10 bg-slate-950/10 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
                            {auth.isAdmin ? 'Admin Access' : 'Standard User'}
                        </span>
                    </div>
                </header>

                <div className="p-10 max-w-7xl mx-auto w-full">
                    {children}
                </div>
            </main>
        </div>
    );
}