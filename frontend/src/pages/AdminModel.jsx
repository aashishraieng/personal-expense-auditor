import { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { getModelStatus, retrainModel } from "../api/admin";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid
} from "recharts";

export default function AdminModel() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [training, setTraining] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        loadStatus();
    }, []);

    async function loadStatus() {
        try {
            setLoading(true);
            const res = await getModelStatus();
            // Handle both axios and raw fetch response formats
            setStatus(res.data || res);
        } catch (err) {
            setError("Failed to fetch model status. Are you logged in as admin?");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleRetrain() {
        const ok = confirm(
            "This will retrain the AI model using your manually corrected data. This may take a few seconds. Continue?"
        );
        if (!ok) return;

        try {
            setTraining(true);
            await retrainModel();
            await loadStatus();
            alert("Model retrained successfully!");
        } catch (err) {
            alert("Retraining failed: " + (err.message || "Server Error"));
        } finally {
            setTraining(false);
        }
    }

    if (loading) {
        return (
            <AppLayout>
                <div className="flex justify-center p-12 text-slate-400">Loading model intelligence...</div>
            </AppLayout>
        );
    }

    if (error) {
        return (
            <AppLayout>
                <div className="bg-red-900/20 border border-red-500 text-red-400 p-6 rounded-lg">{error}</div>
            </AppLayout>
        );
    }

    // Prepare data for the accuracy chart (using accuracy from status)
    const chartData = [
        { name: 'Current Accuracy', score: (status.accuracy || 0) * 100 }
    ];

    return (
        <AppLayout>
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-white">Model Intelligence</h2>
                <p className="text-slate-400">Monitor and improve your categorization engine.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Model Info Card */}
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        System Overview
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Version</span>
                            <span className="text-white font-mono">{status.model_version || "v1.0"}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Last Training</span>
                            <span className="text-white">
                                {status.last_trained_at ? new Date(status.last_trained_at).toLocaleDateString() : "Never"}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Status</span>
                            <span className={training || status.training ? "text-yellow-400 animate-pulse" : "text-emerald-400"}>
                                {training || status.training ? "Training..." : "Ready"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Data Stats Card */}
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        Dataset Size
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Total SMS Processed</span>
                            <span className="text-white font-bold">{status.total_samples || 0}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Total Corrections</span>
                            <span className="text-white font-bold">{status.corrected_samples || 0}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Unused Learning Data</span>
                            <span className="text-orange-400 font-bold">{status.new_corrections || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Performance Chart Card */}
                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                    <h3 className="text-lg font-semibold mb-6 text-slate-200">Model Performance</h3>
                    {/* 🔥 FIX: Added a fixed height of 300px */}
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                                <Bar dataKey="score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Action Section */}
            <div className="mt-8 bg-indigo-500/5 border border-indigo-500/20 p-8 rounded-2xl flex flex-col items-center text-center">
                <h3 className="text-xl font-bold mb-2">Retrain with Latest Data</h3>
                <p className="text-slate-400 max-w-md mb-6">
                    Update the categorization engine with your manual corrections to improve future expense auditing accuracy.
                </p>
                <button
                    onClick={handleRetrain}
                    disabled={training || status.training}
                    className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {training ? (
                        <span className="flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Retraining AI...
                        </span>
                    ) : "Execute Retraining"}
                </button>
            </div>
        </AppLayout>
    );
}