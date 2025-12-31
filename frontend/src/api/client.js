// Change this line:
const API_BASE = "http://localhost:5000";

export async function apiRequest(path, options = {}) {
    const token = localStorage.getItem("token");
    const headers = { ...(options.headers || {}) };

    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    try {
        const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

        if (res.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "/";
            throw new Error("Unauthorized");
        }

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || "Request failed");
        }

        return res.json();
    } catch (error) {
        console.error("API Request Error:", error.message);
        throw error;
    }
}