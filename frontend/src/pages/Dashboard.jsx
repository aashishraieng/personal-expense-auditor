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
                const data = await fetchSMS();
                setSmsList(data.items || data);
            } catch {
                setError("Failed to load transactions");
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

        // Date filters (IMPORTANT: created_at)
        const smsDate = new Date(sms.created_at);

        if (startDate && smsDate < new Date(startDate)) return false;
        if (endDate && smsDate > new Date(endDate)) return false;

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
                        ? { ...sms, category: editCategory, amount: editAmount }
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
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">Dashboard</h2>

                <div className="flex gap-3">
                    {/* Category Filter */}
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-slate-900 border border-slate-700 px-3 py-2 rounded"
                    >
                        {CATEGORY_OPTIONS.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>

                    {/* Date Range */}
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-slate-900 border border-slate-700 px-3 py-2 rounded"
                    />

                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-slate-900 border border-slate-700 px-3 py-2 rounded"
                    />
                </div>
            </div>

            {loading && <p className="text-slate-400">Loading...</p>}
            {error && <p className="text-red-400">{error}</p>}

            {!loading && filteredSmsList.length === 0 && (
                <p className="text-slate-400">No transactions match the filter.</p>
            )}

            {!loading && filteredSmsList.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full border border-slate-800 rounded-lg">
                        <thead className="bg-slate-900 text-slate-400 text-sm">
                            <tr>
                                <th className="p-3 text-left">Date</th>
                                <th className="p-3 text-left">Text</th>
                                <th className="p-3 text-left">Category</th>
                                <th className="p-3 text-right">Amount</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredSmsList.map((sms) => (
                                <tr
                                    key={sms.id}
                                    className="border-t border-slate-800 hover:bg-slate-900/40"
                                >
                                    <td className="p-3 text-sm text-slate-400">
                                        {new Date(sms.created_at).toLocaleDateString()}
                                    </td>

                                    <td className="p-3">{sms.text}</td>

                                    <td className="p-3">
                                        {editingId === sms.id ? (
                                            <select
                                                value={editCategory}
                                                onChange={(e) => setEditCategory(e.target.value)}
                                                className="bg-slate-800 border border-slate-700 rounded px-2 py-1"
                                            >
                                                {CATEGORY_OPTIONS.filter((c) => c !== "All").map(
                                                    (cat) => (
                                                        <option key={cat} value={cat}>
                                                            {cat}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                        ) : (
                                            sms.category
                                        )}
                                    </td>

                                    <td className="p-3 text-right">
                                        {editingId === sms.id ? (
                                            <input
                                                type="number"
                                                value={editAmount}
                                                onChange={(e) =>
                                                    setEditAmount(Number(e.target.value))
                                                }
                                                className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right"
                                            />
                                        ) : (
                                            `₹ ${sms.amount ?? 0}`
                                        )}
                                    </td>

                                    <td className="p-3 text-right space-x-2">
                                        {editingId === sms.id ? (
                                            <>
                                                <button
                                                    onClick={() => saveEdit(sms.id)}
                                                    className="text-emerald-400 hover:text-emerald-300 text-sm"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="text-slate-400 hover:text-slate-300 text-sm"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => startEdit(sms)}
                                                className="text-blue-400 hover:text-blue-300 text-sm"
                                            >
                                                Edit
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
