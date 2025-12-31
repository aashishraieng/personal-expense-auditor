import { apiRequest } from "./client";

/**
 * Trigger model retraining (ADMIN)
 * Updated to match the '/api/model/reload' route in app.py
 */
export function retrainModel() {
    return apiRequest("/api/model/reload", {
        method: "POST",
    });
}

/**
 * Fetch model status (ADMIN)
 * Used by AdminModel.jsx
 */
export function getModelStatus() {
    return apiRequest("/api/model/status", {
        method: "GET",
    });
}