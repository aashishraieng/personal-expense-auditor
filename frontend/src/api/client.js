const API_BASE = "http://127.0.0.1:5000";

export async function apiRequest(path, options = {}) {
    const token = localStorage.getItem("token");

    const headers = {
        ...(options.headers || {}),
    };

    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    // 🔥 THIS IS THE KEY FIX
    if (res.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("is_admin");
        window.location.href = "/"; // force re-login
        throw new Error("Unauthorized");
    }

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Request failed");
    }

    return res.json();
}



// const API_BASE = "http://127.0.0.1:5000";

// export async function apiRequest(path, options = {}) {
//     const token = localStorage.getItem("token");

//     const headers = {
//         ...(options.headers || {}),
//     };

//     if (!(options.body instanceof FormData)) {
//         headers["Content-Type"] = "application/json";
//     }

//     if (token) {
//         headers.Authorization = `Bearer ${token}`;
//     }

//     const response = await fetch(`${API_BASE}${path}`, {
//         ...options,
//         headers,
//     });

//     if (!response.ok) {
//         let message = "API request failed";
//         try {
//             const data = await response.json();
//             message = data.message || message;
//         } catch { }
//         throw new Error(message);
//     }

//     if (response.status === 204) return null;

//     return response.json();
// }
