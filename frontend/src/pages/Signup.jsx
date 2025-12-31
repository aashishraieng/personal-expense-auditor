import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import {
    UserIcon,
    EnvelopeIcon,
    LockClosedIcon,
    SparklesIcon
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";

export default function Signup() {
    const [formData, setFormData] = useState({ name: "", email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await apiRequest("/api/auth/signup", {
                method: "POST",
                body: JSON.stringify(formData),
            });
            localStorage.setItem("token", res.token);
            navigate("/dashboard");
        } catch (err) {
            setError(err.message || "Signup failed. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Aesthetic Blobs - Shared with Login */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md bg-slate-900/40 backdrop-blur-2xl border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl relative z-10"
            >
                <div className="text-center mb-10">
                    <div className="h-16 w-16 bg-gradient-to-tr from-indigo-600 to-violet-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/20">
                        <SparklesIcon className="h-10 w-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Create Account</h2>
                    <p className="text-slate-500 mt-2">Start auditing your expenses with AI</p>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-sm mb-6 text-center font-medium"
                    >
                        {error}
                    </motion.div>
                )}

                <form onSubmit={handleSignup} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Full Name</label>
                        <div className="relative group">
                            <UserIcon className="absolute left-4 top-3.5 h-5 w-5 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                            <input
                                type="text" required
                                placeholder="Ashish"
                                className="w-full bg-slate-950/50 border border-slate-800 text-white pl-12 pr-4 py-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-700"
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Email Address</label>
                        <div className="relative group">
                            <EnvelopeIcon className="absolute left-4 top-3.5 h-5 w-5 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                            <input
                                type="email" required
                                placeholder="ashish@example.com"
                                className="w-full bg-slate-950/50 border border-slate-800 text-white pl-12 pr-4 py-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-700"
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Password</label>
                        <div className="relative group">
                            <LockClosedIcon className="absolute left-4 top-3.5 h-5 w-5 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                            <input
                                type="password" required
                                placeholder="••••••••"
                                className="w-full bg-slate-950/50 border border-slate-800 text-white pl-12 pr-4 py-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-700"
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-500/30 transition-all active:scale-[0.98] disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : "Join Now"}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-slate-500 text-sm">
                        Already have an account?{" "}
                        <Link to="/" className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors">Sign In</Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}