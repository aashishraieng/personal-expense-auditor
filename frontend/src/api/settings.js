// api/settings.js
import { apiRequest } from "./client";

export const getSettings = () =>
    apiRequest("/api/settings");

export const saveSettings = (data) =>
    apiRequest("/api/settings", {
        method: "PUT",
        body: JSON.stringify(data),
    });
