import { apiRequest } from "./client";

/**
 * Fetches all SMS transactions.
 * Returns the full response object which contains { items: [], total: X }
 */
export async function fetchSMS() {
    return apiRequest("/api/sms");
}

/**
 * Updates a specific transaction's category or amount.
 */
export async function updateSMS(id, payload) {
    return apiRequest(`/api/sms/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });
}

/**
 * Uploads a CSV file to the backend.
 * Note: client.js should NOT set Content-Type for FormData to allow 
 * the browser to set the boundary automatically.
 */
export async function uploadSMSFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    return apiRequest("/api/sms/upload", {
        method: "POST",
        body: formData,
        // Do NOT add Content-Type header here; FormData handles it
    });
}

/**
 * Fetches the monthly summary (Income vs Expense).
 * @param {string} month - Format: "YYYY-MM"
 */
export async function getMonthlySummary(month) {
    // If no month is provided, the backend will default to current month
    const query = month ? `?month=${month}` : "";
    return apiRequest(`/api/summary${query}`);
}