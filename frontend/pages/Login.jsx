import { useState } from "react";
import { login } from "../api/auth";

export default function Login({ onLogin }) {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const data = await login(email, password);
            onLogin(data.token, data.is_admin);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-lg p-6">
                <h1 className="text-2xl font-semibold text-white">Sign in</h1>

                <p className="text-slate-400 text-sm mt-1">
                    Access your expense dashboard
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>

                    <button
                        disabled={loading}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-slate-900 font-medium py-2 rounded-md transition"
                    >
                        {loading ? "Signing in..." : "Sign in"}
                    </button>

                    {error && (
                        <div className="text-sm text-red-400">
                            {error}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
