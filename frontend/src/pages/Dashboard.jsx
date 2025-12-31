import { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { fetchSMS, updateSMS } from "../api/sms";

const CATEGORY_OPTIONS = [
    "All",
    "Food",
    "Travel",
    "Shopping",
    "Bills",
    "Income",
    "Refund",
    "Expense",
    "Unknown",
];

export default function Dashboard() {
    const [smsList, setSmsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Filters
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Edit state
    const [editingId, setEditingId] = useState(null);
    const [editCategory, setEditCategory] = useState("");
    const [editAmount, setEditAmount] = useState(0);

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                const response = await fetchSMS();

                // IMPORTANT: Backend returns { items: [...], total: X }
                // We extract 'items' or default to empty array
                const data = response.data?.items || response.items || (Array.isArray(response) ? response : []);

                // Sort by date newest first
                const sortedData = [...data].sort((a, b) =>
                    new Date(b.created_at) - new Date(a.created_at)
                );

                setSmsList(sortedData);
            } catch (err) {
                console.error("Fetch Error:", err);
                setError("Failed to load transactions. Check connection.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    /* ---------------- FILTER LOGIC ---------------- */

    const filteredSmsList = smsList.filter((sms) => {
        // Category filter
        if (categoryFilter !== "All" && sms.category !== categoryFilter) {
            return false;
        }

        // Date filters
        const smsDate = new Date(sms.created_at);
        if (startDate && smsDate < new Date(startDate)) return false;
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59); // Include full end day
            if (smsDate > end) return false;
        }

        return true;
    });

    /* ---------------- EDIT LOGIC ---------------- */

    function startEdit(sms) {
        setEditingId(sms.id);
        setEditCategory(sms.category);
        setEditAmount(sms.amount ?? 0);
    }

    function cancelEdit() {
        setEditingId(null);
        setEditCategory("");
        setEditAmount(0);
    }

    async function saveEdit(id) {
        try {
            await updateSMS(id, {
                category: editCategory,
                amount: editAmount,
            });

            setSmsList((prev) =>
                prev.map((sms) =>
                    sms.id === id
                        ? { ...sms, category: editCategory, amount: editAmount, corrected: true }
                        : sms
                )
            );

            cancelEdit();
        } catch {
            alert("Failed to update SMS");
        }
    }

    /* ---------------- UI ---------------- */

    return (
        <AppLayout>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Transactions</h2>
                    <p className="text-slate-400 text-sm">
                        Showing {filteredSmsList.length} items
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    {/* Category Filter */}
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        {CATEGORY_OPTIONS.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>

                    {/* Date Range */}
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded px-2">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-slate-200 py-1 outline-none text-sm"
                        />
                        <span className="text-slate-500">to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-slate-200 py-1 outline-none text-sm"
                        />
                    </div>
                </div>
            </div>

            {loading && (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            )}

            {error && <div className="bg-red-900/20 border border-red-500 text-red-400 p-4 rounded mb-4">{error}</div>}

            {!loading && filteredSmsList.length === 0 && (
                <div className="text-center p-12 bg-slate-900/50 rounded-lg border border-dashed border-slate-700">
                    <p className="text-slate-400">No transactions found matching your criteria.</p>
                </div>
            )}

            {!loading && filteredSmsList.length > 0 && (
                <div className="bg-slate-900/30 rounded-lg border border-slate-800 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-4 font-semibold">Date</th>
                                <th className="p-4 font-semibold">Transaction Details</th>
                                <th className="p-4 font-semibold">Category</th>
                                <th className="p-4 font-semibold text-right">Amount</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-800">
                            {filteredSmsList.map((sms) => (
                                <tr key={sms.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="p-4 text-sm text-slate-400 whitespace-nowrap">
                                        {new Date(sms.created_at).toLocaleDateString(undefined, {
                                            month: 'short', day: 'numeric', year: 'numeric'
                                        })}
                                    </td>

                                    <td className="p-4 text-slate-200 max-w-xs md:max-w-md break-words">
                                        {sms.text}
                                    </td>

                                    <td className="p-4">
                                        {editingId === sms.id ? (
                                            <select
                                                value={editCategory}
                                                onChange={(e) => setEditCategory(e.target.value)}
                                                className="bg-slate-800 border border-slate-600 text-white rounded px-2 py-1 outline-none focus:border-blue-500"
                                            >
                                                {CATEGORY_OPTIONS.filter((c) => c !== "All").map((cat) => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${sms.category === 'Income' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    sms.category === 'Unknown' ? 'bg-slate-500/10 text-slate-400' : 'bg-blue-500/10 text-blue-400'
                                                }`}>
                                                {sms.category}
                                            </span>
                                        )}
                                    </td>

                                    <td className="p-4 text-right font-mono">
                                        {editingId === sms.id ? (
                                            <input
                                                type="number"
                                                value={editAmount}
                                                onChange={(e) => setEditAmount(Number(e.target.value))}
                                                className="w-24 bg-slate-800 border border-slate-600 text-white rounded px-2 py-1 text-right outline-none focus:border-blue-500"
                                            />
                                        ) : (
                                            <span className={sms.category === 'Income' ? 'text-emerald-400' : 'text-slate-200'}>
                                                {sms.category === 'Income' ? '+' : '-'} ₹{sms.amount?.toLocaleString() ?? 0}
                                            </span>
                                        )}
                                    </td>

                                    <td className="p-4 text-right">
                                        {editingId === sms.id ? (
                                            <div className="flex justify-end gap-3">
                                                <button onClick={() => saveEdit(sms.id)} className="text-emerald-400 hover:text-emerald-300 font-medium text-sm">Save</button>
                                                <button onClick={cancelEdit} className="text-slate-500 hover:text-slate-400 font-medium text-sm">Cancel</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEdit(sms)}
                                                className="text-blue-400 hover:text-blue-300 transition-colors"
                                                title="Edit Transaction"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                </svg>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </AppLayout>
    );
}