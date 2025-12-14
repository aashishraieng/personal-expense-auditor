import { apiRequest } from "./client";

export function retrainModel() {
    return apiRequest("/api/model/reload", {
        method: "POST",
    });
}
