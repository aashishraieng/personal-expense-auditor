import { apiRequest } from "./client";

export function loginRequest(email, password) {
    return apiRequest("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
}

export function signupRequest(email, password) {
    return apiRequest("/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
}
