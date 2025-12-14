import { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { fetchSMS, updateSMS } from "../api/sms";
import { retrainModel } from "../api/admin";
import { useAuth } from "../hooks/useAuth";

export default function Dashboard({ onLogout }) {
    const [smsList, setSmsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [editingId, setEditingId] = useState(null);
    const [editCategory, setEditCategory] = useState("");
    const [editAmount, setEditAmount] = useState(0);
    const [retraining, setRetraining] = useState(false);

    const auth = useAuth();


    const CATEGORY_OPTIONS = [
        "Food",
        "Travel",
        "Shopping",
        "Bills",
        "Income",
        "Refund",
        "Unknown",
    ];

    const resetEdit = () => {
        setEditingId(null);
        setEditCategory("");
        setEditAmount(0);
    };

    useEffect(() => {
        async function load() {
            try {
                const data = await fetchSMS();
                setSmsList(data.items || data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    async function handleSave(smsId) {
        try {
            await updateSMS(smsId, {
                category: editCategory,
                amount: editAmount,
            });

            // Optimistic UI update
            setSmsList((prev) =>
                prev.map((sms) =>
                    sms.id === smsId
                        ? { ...sms, category: editCategory, amount: editAmount }
                        : sms
                )
            );

            resetEdit();
        } catch (err) {
            alert(err.message);
        }
    }

    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-semibold">Dashboard</h2>
                <button
                    onClick={onLogout}
                    className="bg-red-500/10 text-red-400 px-4 py-2 rounded-md hover:bg-red-500/20 transition"
                >
                    Logout
                </button>
            </div>

            {loading && <div className="text-slate-400">Loading transactions...</div>}
            {error && <div className="text-red-400">{error}</div>}

            {!loading && !error && (
                <div className="overflow-x-auto">
                    {auth.isAdmin && (
                        <button
                            onClick={async () => {
                                try {
                                    setRetraining(true);
                                    await retrainModel();
                                    alert("Model retrained successfully");
                                } catch (err) {
                                    alert(err.message);
                                } finally {
                                    setRetraining(false);
                                }
                            }}
                            disabled={retraining}
                            className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-md hover:bg-emerald-500/20 transition disabled:opacity-50"
                        >
                            {retraining ? "Retraining..." : "Retrain Model"}
                        </button>
                    )}

                    <table className="w-full border border-slate-800 rounded-lg overflow-hidden">
                        <thead className="bg-slate-900 text-slate-400 text-sm">
                            <tr>
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Text</th>
                                <th className="px-4 py-3 text-left">Category</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {smsList.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-4 py-6 text-center text-slate-500">
                                        No transactions found
                                    </td>
                                </tr>
                            )}

                            {smsList.map((sms) => (
                                <tr
                                    key={sms.id}
                                    className="border-t border-slate-800 hover:bg-slate-900/50"
                                >
                                    <td className="px-4 py-3 text-sm text-slate-400">
                                        {sms.date
                                            ? new Date(sms.date).toLocaleDateString()
                                            : "—"}
                                    </td>

                                    <td className="px-4 py-3 text-sm">{sms.text}</td>

                                    <td className="px-4 py-3 text-sm">
                                        {editingId === sms.id ? (
                                            <select
                                                value={editCategory}
                                                onChange={(e) => setEditCategory(e.target.value)}
                                                className="bg-gray-800 text-white border border-gray-600 rounded px-2 py-1"
                                            >
                                                {CATEGORY_OPTIONS.map((cat) => (
                                                    <option key={cat} value={cat}>
                                                        {cat}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            sms.category
                                        )}
                                    </td>

                                    <td className="px-4 py-3 text-sm text-right">
                                        {editingId === sms.id ? (
                                            <input
                                                type="number"
                                                value={editAmount}
                                                onChange={(e) =>
                                                    setEditAmount(Number(e.target.value))
                                                }
                                                className="w-24 bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-right"
                                            />
                                        ) : (
                                            `₹ ${sms.amount ?? 0}`
                                        )}
                                    </td>

                                    <td className="px-4 py-3 text-right space-x-2">
                                        {editingId === sms.id ? (
                                            <>
                                                <button
                                                    className="text-green-400 hover:text-green-300 text-sm"
                                                    onClick={() => handleSave(sms.id)}
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    className="text-gray-400 hover:text-gray-300 text-sm"
                                                    onClick={resetEdit}
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                className="text-blue-400 hover:text-blue-300 text-sm"
                                                onClick={() => {
                                                    setEditingId(sms.id);
                                                    setEditCategory(sms.category);
                                                    setEditAmount(sms.amount ?? 0);
                                                }}
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
