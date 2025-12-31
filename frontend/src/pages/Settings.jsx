import { useEffect, useState, useRef } from "react";
import AppLayout from "../layouts/AppLayout";
import { getSettings, saveSettings } from "../api/settings";
import { uploadSMSFile } from "../api/sms";
import { useAuth } from "../hooks/useAuth";

export default function Settings() {
    const auth = useAuth();
    const fileInputRef = useRef(null); // 🔥 Standard React way to handle file inputs

    const [settings, setSettings] = useState(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    useEffect(() => {
        getSettings()
            .then((res) => {
                // Handle both raw fetch and axios structures
                setSettings(res.data || res);
            })
            .catch(() => setMessage({ type: "error", text: "Failed to load settings" }));
    }, []);

    // Helper to show temporary messages
    const showMsg = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    };

    function update(key, value) {
        setSettings({ ...settings, [key]: value });
    }

    async function save() {
        setSaving(true);
        try {
            await saveSettings(settings);
            showMsg("success", "Settings saved successfully!");
        } catch (err) {
            showMsg("error", "Failed to save settings");
        } finally {
            setSaving(false);
        }
    }

    async function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Basic validation
        if (!file.name.endsWith(".csv")) {
            showMsg("error", "Please select a valid CSV file");
            return;
        }

        setUploading(true);
        try {
            const res = await uploadSMSFile(file);
            showMsg("success", `Import complete! ${res.inserted || 0} items added.`);
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (err) {
            showMsg("error", err.message || "CSV upload failed");
        } finally {
            setUploading(false);
        }
    }

    if (!settings) {
        return (
            <AppLayout>
                <div className="flex justify-center p-12 text-slate-400 animate-pulse">
                    Loading settings...
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="max-w-2xl">
                <h2 className="text-3xl font-bold mb-2">Settings</h2>
                <p className="text-slate-400 mb-8">Manage your AI auditor preferences and data.</p>

                {message.text && (
                    <div className={`mb-6 p-4 rounded-lg border ${message.type === "success" ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-rose-500/10 border-rose-500 text-rose-400"
                        }`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-8">
                    {/* IMPORT SECTION */}
                    <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Import Data
                        </h3>
                        <p className="text-sm text-slate-400 mb-4">Upload your SMS backup CSV. Columns should include 'text' and 'date'.</p>

                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            disabled={uploading}
                            className="hidden"
                            ref={fileInputRef}
                            id="csv-upload-input"
                        />

                        <button
                            onClick={() => fileInputRef.current.click()}
                            disabled={uploading}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${uploading
                                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                                }`}
                        >
                            {uploading ? (
                                <span className="flex items-center gap-2">
                                    <div className="h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                    Processing...
                                </span>
                            ) : "Select CSV File"}
                        </button>
                    </section>

                    {/* AI PREFERENCES */}
                    <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl space-y-6">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            AI Intelligence
                        </h3>

                        <div className="space-y-4">
                            <label className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors">
                                <span className="text-slate-200">Enable confidence scoring</span>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 accent-emerald-500"
                                    checked={settings.enable_confidence}
                                    onChange={(e) => update("enable_confidence", e.target.checked)}
                                />
                            </label>

                            <label className={`flex items-center justify-between p-3 rounded-lg transition-opacity ${!settings.enable_confidence ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800/50 cursor-pointer'}`}>
                                <span className="text-slate-200">Highlight low-confidence rows</span>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 accent-emerald-500"
                                    checked={settings.highlight_low_confidence}
                                    onChange={(e) => update("highlight_low_confidence", e.target.checked)}
                                    disabled={!settings.enable_confidence}
                                />
                            </label>

                            <div className={`p-3 space-y-3 ${!settings.enable_confidence ? 'opacity-40' : ''}`}>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Confidence Threshold</span>
                                    <span className="text-emerald-400 font-mono">{(settings.confidence_threshold * 100).toFixed(0)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.4"
                                    max="0.9"
                                    step="0.05"
                                    value={settings.confidence_threshold}
                                    onChange={(e) => update("confidence_threshold", Number(e.target.value))}
                                    disabled={!settings.enable_confidence}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>
                        </div>
                    </section>

                    {/* ADMIN CONTROLS */}
                    {auth.user?.is_admin && (
                        <section className="bg-rose-950/10 border border-rose-900/30 p-6 rounded-xl">
                            <h3 className="text-lg font-semibold text-rose-400 mb-4">Admin System Overrides</h3>
                            <label className="flex items-center justify-between p-3 rounded-lg hover:bg-rose-900/10 cursor-pointer">
                                <span className="text-slate-200">Auto-retrain model on corrections</span>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 accent-rose-500"
                                    checked={settings.auto_retrain}
                                    onChange={(e) => update("auto_retrain", e.target.checked)}
                                />
                            </label>
                        </section>
                    )}

                    <button
                        onClick={save}
                        disabled={saving}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                        {saving ? "Saving Changes..." : "Save All Settings"}
                    </button>
                </div>
            </div>
        </AppLayout>
    );
}