import { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { fetchSMS, updateSMS } from "../api/sms";
import { apiRequest } from "../api/client";
import {
    ChevronLeftIcon, ChevronRightIcon,
    FunnelIcon, CalendarIcon,
    ShieldCheckIcon, ArrowPathIcon
} from "@heroicons/react/24/outline";

const CATEGORY_OPTIONS = ["All", "Food", "Travel", "Shopping", "Bills", "Income", "Refund", "Expense", "Unknown"];
const CONFIDENCE_FILTERS = [
    { label: "All Confidence", value: "all" },
    { label: "High (> 80%)", value: "high" },
    { label: "Medium (50-80%)", value: "med" },
    { label: "Low (< 50%)", value: "low" }
];

export default function Dashboard() {
    const [smsList, setSmsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false); // Controls the animation
    const [settings, setSettings] = useState({ confidence_threshold: 0.7 });

    // Filter States
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [confidenceFilter, setConfidenceFilter] = useState("all");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [setRes, smsRes] = await Promise.all([apiRequest("/api/settings"), fetchSMS()]);
            setSettings(setRes);
            const data = smsRes.data?.items || smsRes.items || [];
            setSmsList([...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    const handleReset = () => {
        setCategoryFilter("All");
        setStartDate("");
        setEndDate("");
        setConfidenceFilter("all");
        setCurrentPage(1);
    };

    /* ---------------- FILTER LOGIC ---------------- */
    const filteredSmsList = smsList.filter((sms) => {
        if (categoryFilter !== "All" && sms.category !== categoryFilter) return false;

        if (startDate || endDate) {
            const smsDate = new Date(sms.created_at);
            smsDate.setHours(0, 0, 0, 0);

            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                if (smsDate < start) return false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(0, 0, 0, 0);
                if (smsDate > end) return false;
            }
        }

        const score = (sms.confidence || 0) * 100;
        if (confidenceFilter === "high" && score < 80) return false;
        if (confidenceFilter === "med" && (score < 50 || score >= 80)) return false;
        if (confidenceFilter === "low" && score >= 50) return false;

        return true;
    });

    useEffect(() => { setCurrentPage(1); }, [categoryFilter, startDate, endDate, confidenceFilter]);

    const totalPages = Math.ceil(filteredSmsList.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredSmsList.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-6">
                <div className="animate-in fade-in duration-700">
                    <h2 className="text-2xl font-bold text-white tracking-tight">Transactions</h2>
                    <p className="text-slate-500 text-sm">Review your audited financial messages</p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleReset}
                        className="p-2.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl hover:text-indigo-400 transition-all active:scale-95"
                        title="Clear Filters"
                    >
                        <ArrowPathIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border transition-all duration-300 active:scale-95 shadow-lg ${showFilters
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/20'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                            }`}
                    >
                        <FunnelIcon className={`h-5 w-5 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
                        <span className="font-bold text-sm">Filters</span>
                    </button>
                </div>
            </div>

            {/* --- ANIMATED DROPDOWN FILTER MENU --- */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showFilters ? 'max-h-[400px] opacity-100 mb-8' : 'max-h-0 opacity-0 mb-0'
                }`}>
                <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl grid grid-cols-1 md:grid-cols-3 gap-8 shadow-2xl backdrop-blur-sm">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] ml-1">Category</label>
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer">
                            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] ml-1">AI Confidence</label>
                        <select value={confidenceFilter} onChange={e => setConfidenceFilter(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer">
                            {CONFIDENCE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] ml-1">Date Range</label>
                        <div className="flex items-center gap-2 group">
                            {/* Native date inputs show calendar on click */}
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="bg-slate-950 border border-slate-800 text-white p-3 rounded-2xl text-xs w-full outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer [color-scheme:dark]"
                            />
                            <span className="text-slate-600 font-bold">to</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="bg-slate-950 border border-slate-800 text-white p-3 rounded-2xl text-xs w-full outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer [color-scheme:dark]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* --- TABLE CONTENT --- */}
            <div className="bg-slate-950/50 rounded-[2rem] border border-slate-800/60 overflow-hidden shadow-2xl backdrop-blur-md">
                <table className="w-full text-left">
                    <thead className="bg-slate-900/40 text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
                        <tr>
                            <th className="p-6">Timestamp</th>
                            <th className="p-6">Description</th>
                            <th className="p-6">Classification</th>
                            <th className="p-6 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                        {currentItems.map((sms) => (
                            <tr key={sms.id} className="hover:bg-indigo-500/[0.03] transition-colors group">
                                <td className="p-6 text-xs text-slate-500 font-mono">
                                    {new Date(sms.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                </td>
                                <td className="p-6 text-slate-300 text-sm max-w-md leading-relaxed">{sms.text}</td>
                                <td className="p-6">
                                    <div className="flex flex-col gap-1.5">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black w-fit uppercase tracking-wider ${sms.category === 'Income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'
                                            }`}>
                                            {sms.category}
                                        </span>
                                        <div className="w-20 h-1 bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500/50"
                                                style={{ width: `${(sms.confidence || 0) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-6 text-right font-mono text-slate-100 font-bold">₹{sms.amount?.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- PAGINATION --- */}
            <div className="mt-10 flex flex-col md:flex-row justify-between items-center gap-6 pb-10">
                <div className="flex gap-1.5">
                    {[...Array(totalPages)].map((_, i) => (
                        <button
                            key={i + 1}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all duration-300 ${currentPage === i + 1
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110'
                                : 'text-slate-500 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-white disabled:opacity-20 transition-all active:scale-90"
                    >
                        <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <span className="text-slate-500 text-sm font-medium uppercase tracking-widest">Page {currentPage} of {totalPages || 1}</span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-white disabled:opacity-20 transition-all active:scale-90"
                    >
                        <ChevronRightIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </AppLayout>
    );
}