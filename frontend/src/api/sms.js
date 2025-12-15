import client from "./client";
import apiRequest from "./client";

export async function fetchSMS() {
    const res = await client.get("/api/sms");
    return res.data;
}

export async function updateSMS(id, payload) {
    const res = await client.put(`/api/sms/${id}`, payload);
    return res.data;
}

export async function uploadSMSFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await client.post("/api/sms/upload", formData);
    return res.data;
}

export async function getMonthlySummary(month) {
    const res = await client.get(`/api/summary?month=${month}`);
    return res.data;
}


export function fetchSummary(month) {
    return apiRequest(`/api/summary?month=${month}`);
}