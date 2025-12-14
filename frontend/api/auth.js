import { apiRequest } from "./client";

export async function login(email, password) {
    return apiRequest("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
}

export function signup(email, password) {
    return apiRequest("/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
}