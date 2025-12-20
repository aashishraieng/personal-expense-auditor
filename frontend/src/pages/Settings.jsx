import { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { getSettings, saveSettings } from "../api/settings";

export default function Settings() {
    const [settings, setSettings] = useState(null);
    const [saving, setSaving] = useState(false);

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

    return (
        <AppLayout>
            <h2 className="text-2xl font-semibold mb-6">Settings</h2>

            <div className="bg-slate-900 p-6 rounded-lg max-w-xl space-y-6">

                <h3 className="text-lg font-medium">Model Intelligence</h3>

                <label className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={settings.enable_confidence}
                        onChange={(e) => update("enable_confidence", e.target.checked)}
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

                <label className="flex items-center gap-3 opacity-60">
                    <input
                        type="checkbox"
                        checked={settings.auto_retrain}
                        disabled
                    />
                    Auto retrain on corrections (coming soon)
                </label>

                <button
                    onClick={save}
                    disabled={saving}
                    className="bg-sky-500/20 text-sky-400 px-4 py-2 rounded"
                >
                    {saving ? "Saving…" : "Save Settings"}
                </button>
            </div>
        </AppLayout>
    );
}
