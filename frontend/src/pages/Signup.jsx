import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signupRequest } from "../api/auth";
import { useAuth } from "../context/AuthContext";


export default function Signup() {
    const navigate = useNavigate();
    const auth = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        try {
            const data = await signupRequest(email, password);
            auth.login(data);
            navigate("/");
        } catch (err) {
            setError(err.message || "Signup failed");
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md bg-slate-900 p-8 rounded-xl border border-slate-800"
            >
                <h2 className="text-2xl font-semibold mb-6">Sign Up</h2>

                {error && <p className="text-red-400 mb-4">{error}</p>}

                <input
                    type="email"
                    placeholder="Email"
                    className="w-full mb-4 px-3 py-2 rounded bg-slate-800 border border-slate-700"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <input
                    type="password"
                    placeholder="Password"
                    className="w-full mb-6 px-3 py-2 rounded bg-slate-800 border border-slate-700"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <button className="w-full bg-emerald-500 text-black py-2 rounded font-medium">
                    Create Account
                </button>

                <p className="text-sm text-slate-400 mt-4">
                    Already have an account?{" "}
                    <Link to="/login" className="text-emerald-400 hover:underline">
                        Login
                    </Link>
                </p>
            </form>
        </div>
    );
}
