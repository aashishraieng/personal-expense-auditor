import { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { getSettings, saveSettings } from "../api/settings";
import { uploadSMSFile } from "../api/sms";
import { useAuth } from "../hooks/useAuth";

export default function Settings() {
    const auth = useAuth();

    const [settings, setSettings] = useState(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        getSettings().then(setSettings);
    }, []);

    if (!settings) {
        return <AppLayout>Loading settings…</AppLayout>;
    }

    function update(key, value) {
        setSettings({ ...settings, [key]: value });
    }

    async function save() {
        setSaving(true);
        await saveSettings(settings);
        setSaving(false);
        alert("Settings saved");
    }

    async function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            await uploadSMSFile(file);
            alert("CSV uploaded successfully");
        } catch {
            alert("CSV upload failed");
        } finally {
            setUploading(false);
        }
    }

    return (
        <AppLayout>
            <h2 className="text-2xl font-semibold mb-6">Settings</h2>

            <div className="bg-slate-900 p-6 rounded-lg max-w-xl space-y-6">

                {/* MODEL INTELLIGENCE */}
                <h3 className="text-lg font-medium">Model Intelligence</h3>

                <label className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={settings.enable_confidence}
                        onChange={(e) =>
                            update("enable_confidence", e.target.checked)
                        }
                    />
                    Enable confidence scoring
                </label>

                <label className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={settings.highlight_low_confidence}
                        onChange={(e) =>
                            update("highlight_low_confidence", e.target.checked)
                        }
                        disabled={!settings.enable_confidence}
                    />
                    Highlight low-confidence predictions
                </label>

                <div>
                    <label className="block text-sm mb-1">
                        Confidence threshold ({settings.confidence_threshold})
                    </label>
                    <input
                        type="range"
                        min="0.4"
                        max="0.9"
                        step="0.05"
                        value={settings.confidence_threshold}
                        onChange={(e) =>
                            update("confidence_threshold", Number(e.target.value))
                        }
                        disabled={!settings.enable_confidence}
                        className="w-full"
                    />
                </div>

                {/* CSV UPLOAD */}
                <div className="pt-4 border-t border-slate-700">
                    <h3 className="text-lg font-medium mb-2">Import SMS Backup</h3>

                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                        ref={(input) => {
                            // Assign ref to a variable if needed, or use a state/ref from component
                            // But cleaner way: use a ref in the component body
                            if (input) window.fileInput = input;
                        }}
                        id="csv-upload-input"
                    />

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => document.getElementById("csv-upload-input").click()}
                            disabled={uploading}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded transition-colors"
                        >
                            {uploading ? "Uploading..." : "Choose CSV File"}
                        </button>
                    </div>

                    {uploading && (
                        <p className="text-slate-400 text-sm mt-2">
                            Uploading...
                        </p>
                    )}
                </div>

                {/* ADMIN ONLY */}
                {auth.isAdmin && (
                    <div className="pt-4 border-t border-slate-700">
                        <h3 className="text-lg font-medium text-red-400">
                            Admin Controls
                        </h3>

                        <label className="flex items-center gap-3 mt-2">
                            <input
                                type="checkbox"
                                checked={settings.auto_retrain}
                                onChange={(e) =>
                                    update("auto_retrain", e.target.checked)
                                }
                            />
                            Auto retrain model on corrections
                        </label>
                    </div>
                )}

                <div className="pt-6">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-medium px-4 py-2 rounded transition-colors"
                    >
                        {saving ? "Saving…" : "Save Settings"}
                    </button>
                </div>
            </div>
        </AppLayout>
    );
}
