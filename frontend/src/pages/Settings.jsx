import { useRef, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { uploadSMSFile } from "../api/sms";
import { retrainModel } from "../api/admin";
import { useAuth } from "../context/AuthContext";


export default function Settings() {
    const fileRef = useRef(null);
    const auth = useAuth();
    const [status, setStatus] = useState("");

    async function handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            await uploadSMSFile(file);
            setStatus("CSV uploaded successfully");
        } catch {
            setStatus("Upload failed");
        }
    }

    async function handleRetrain() {
        try {
            await retrainModel();
            setStatus("Model retrained successfully");
        } catch (err) {
            if (err.response?.status === 403) {
                setStatus("Admin access required");
            } else {
                setStatus("Retrain failed");
            }
        }
    }


    return (
        <AppLayout>
            <h2 className="text-2xl font-semibold mb-6">Settings</h2>

            {status && <p className="mb-4 text-emerald-400">{status}</p>}

            <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleUpload}
                className="hidden"
            />

            <button
                onClick={() => fileRef.current.click()}
                className="bg-blue-500/20 text-blue-400 px-4 py-2 rounded mr-4"
            >
                Upload CSV
            </button>

            {auth.isAdmin && (
                <button
                    onClick={handleRetrain}
                    className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded"
                >
                    Retrain Model
                </button>
            )}
        </AppLayout>
    );
}
