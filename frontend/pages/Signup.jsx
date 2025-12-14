import { useState } from "react";
import { signup } from "../api/auth";

export default function Signup({ onBack }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setMessage("");
        setLoading(true);

        try {
            const res = await signup(email, password);
            setMessage(res.message);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-lg p-6">
                <h1 className="text-2xl font-semibold text-white">Create account</h1>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <input
                        type="email"
                        placeholder="Email"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    <button
                        disabled={loading}
                        className="w-full bg-emerald-500 text-black py-2 rounded disabled:opacity-60"
                    >
                        {loading ? "Creating..." : "Sign up"}
                    </button>

                    {message && (
                        <div className="text-green-400 text-sm">{message}</div>
                    )}

                    {error && (
                        <div className="text-red-400 text-sm">{error}</div>
                    )}
                </form>

                <button
                    onClick={onBack}
                    className="mt-4 text-sm text-slate-400 hover:text-slate-300"
                >
                    Back to login
                </button>
            </div>
        </div>
    );
}
