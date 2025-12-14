const API_BASE = "http://127.0.0.1:5000";

export async function apiRequest(path, options = {}) {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_BASE}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
        ...options,
    });

    let data;
    try {
        data = await res.json();
    } catch {
        data = null;
    }

    if (!res.ok) {
        const message = data?.message || "Request failed";
        throw new Error(message);
    }

    return data;
}
