import { apiRequest } from "./client";

export function fetchSMS() {
    return apiRequest("/api/sms");
}

export function updateSMS(id, updates) {
    return apiRequest(`/api/sms/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
    });
}
