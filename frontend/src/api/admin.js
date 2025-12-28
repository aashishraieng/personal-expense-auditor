import { apiRequest } from "./client";

/**
 * Trigger model retraining (ADMIN)
 */
export function retrainModel() {
    return apiRequest("/api/model/retrain", {
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
