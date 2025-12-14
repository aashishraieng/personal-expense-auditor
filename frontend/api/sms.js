import { apiRequest } from "./client";

export function fetchSMS() {
    return apiRequest("/api/sms");
}

export function updateSMS(id, payload) {
    return apiRequest(`/api/sms/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

export function uploadSMSFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    return apiRequest("/api/sms/upload", {
        method: "POST",
        body: formData,
    });
}
