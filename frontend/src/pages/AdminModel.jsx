import { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { getModelStatus, retrainModel } from "../api/admin";

export default function AdminModel() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [training, setTraining] = useState(false);

    useEffect(() => {
        loadStatus();
    }, []);

    async function loadStatus() {
        setLoading(true);
        const res = await getModelStatus();
        setStatus(res);
        setLoading(false);
    }

    async function handleRetrain() {
        const ok = confirm(
            "This will retrain the model using all corrected data. Continue?"
        );
        if (!ok) return;

        setTraining(true);
        await retrainModel();
        await loadStatus();
        setTraining(false);
        alert("Model retrained successfully");
    }

    if (loading) {
        return <AppLayout>Loading model status…</AppLayout>;
    }

    return (
        <AppLayout>
            <h2 className="text-2xl font-semibold mb-6">Model Status</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">

                {/* Model Info */}
                <div className="bg-slate-900 p-6 rounded-lg">
                    <h3 className="font-medium mb-4">Model Info</h3>

                    <div className="space-y-2 text-sm text-slate-300">
                        <div>
                            <span className="text-slate-400">Version:</span>{" "}
                            {status.model_version}
                        </div>
                        <div>
                            <span className="text-slate-400">Last trained:</span>{" "}
                            {status.last_trained_at
                                ? new Date(status.last_trained_at).toLocaleString()
                                : "Never"}
                        </div>
                        <div>
                            <span className="text-slate-400">Status:</span>{" "}
                            {status.training ? (
                                <span className="text-yellow-400">Training</span>
                            ) : (
                                <span className="text-emerald-400">Idle</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Data Readiness */}
                <div className="bg-slate-900 p-6 rounded-lg">
                    <h3 className="font-medium mb-4">Training Data</h3>

                    <div className="space-y-2 text-sm text-slate-300">
                        <div>
                            <span className="text-slate-400">Total SMS:</span>{" "}
                            {status.total_samples}
                        </div>
                        <div>
                            <span className="text-slate-400">Corrected samples:</span>{" "}
                            {status.corrected_samples}
                        </div>
                        <div>
                            <span className="text-slate-400">New corrections:</span>{" "}
                            <span className={status.new_corrections > 0
                                ? "text-orange-400"
                                : "text-slate-400"}>
                                {status.new_corrections}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-8">
                <button
                    onClick={handleRetrain}
                    disabled={training || status.training}
                    className="bg-emerald-500/20 text-emerald-400 px-5 py-2 rounded
                               hover:bg-emerald-500/30 disabled:opacity-50"
                >
                    {training ? "Retraining…" : "Retrain Model"}
                </button>

                {status.new_corrections > 0 && (
                    <p className="text-sm text-slate-400 mt-2">
                        {status.new_corrections} new corrections available for training
                    </p>
                )}
            </div>
        </AppLayout>
    );
}
