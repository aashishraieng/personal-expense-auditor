import { apiRequest } from "./client";

export async function login(email, password) {
    return apiRequest("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
}
