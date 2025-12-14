import { useRef, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { uploadSMSFile } from "../api/sms";
import { retrainModel } from "../api/admin";
import { useAuth } from "../hooks/useAuth";
import StatusBanner from "../src/components/StatusBanner";

export default function Settings({ onBack }) {
    const auth = useAuth();

    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [retraining, setRetraining] = useState(false);
    const [status, setStatus] = useState({ message: "", type: "success" });
    const fileInputRef = useRef(null);


    const showStatus = (message, type = "success") => {
        setStatus({ message, type });
        setTimeout(() => setStatus({ message: "", type }), 3000);
    };

    function handleChooseFile() {
        fileInputRef.current.click();
    }

    async function handleFileSelected(e) {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        try {
            setUploading(true);
            const res = await uploadSMSFile(selectedFile);
            showStatus(res.message || "File uploaded successfully");
        } catch (err) {
            showStatus(err.message || "Upload failed", "error");
        } finally {
            setUploading(false);
            e.target.value = ""; // reset input
        }
    }


    async function handleRetrain() {
        try {
            setRetraining(true);
            await retrainModel();
            showStatus("Model retrained successfully");
        } catch (err) {
            showStatus(err.message || "Retrain failed", "error");
        } finally {
            setRetraining(false);
        }
    }

    return (
        <AppLayout>
            <StatusBanner
                message={status.message}
                type={status.type}
                onClose={() => setStatus({ message: "", type: "success" })}
            />

            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-semibold">Settings</h2>
                <button
                    onClick={onBack}
                    className="text-slate-400 hover:text-white"
                >
                    ← Back
                </button>
            </div>

            {/* Upload Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-medium mb-4">Upload SMS Backup</h3>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelected}
                    className="hidden"
                />

                <button
                    onClick={handleChooseFile}
                    disabled={uploading}
                    className="bg-blue-500/20 text-blue-400 px-4 py-2 rounded
    hover:bg-blue-500/30 transition disabled:opacity-50"
                >
                    {uploading ? "Uploading..." : "Upload CSV"}
                </button>

                <p className="text-slate-500 text-sm mt-3">
                    Upload a CSV file containing SMS text.
                </p>
            </div>


            {/* Admin Section */}
            {auth.isAdmin && (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                    <h3 className="text-xl font-medium mb-4 text-emerald-400">
                        Admin Controls
                    </h3>

                    <button
                        onClick={handleRetrain}
                        disabled={retraining}
                        className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded
            hover:bg-emerald-500/30 transition disabled:opacity-50"
                    >
                        {retraining ? "Retraining..." : "Retrain Model"}
                    </button>
                </div>
            )}
        </AppLayout>
    );
}
