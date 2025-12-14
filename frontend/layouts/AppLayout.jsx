export default function AppLayout({ children }) {
    return (
        <div className="min-h-screen flex bg-slate-950 text-slate-100">

            {/* Sidebar */}
            <aside className="w-64 shrink-0 bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 p-6">
                <h1 className="text-2xl font-bold text-white">
                    Expense Auditor
                </h1>

                <nav className="mt-8 space-y-3 text-sm">
                    <div className="text-slate-300 hover:text-white cursor-pointer">
                        Dashboard
                    </div>
                    <div className="text-slate-300 hover:text-white cursor-pointer">
                        Summary
                    </div>
                    <div className="text-slate-300 hover:text-red-400 cursor-pointer">
                        Logout
                    </div>
                </nav>
            </aside>

            {/* Main */}
            <main className="flex-1 p-8 bg-slate-950">
                {children}
            </main>

        </div>
    );
}
