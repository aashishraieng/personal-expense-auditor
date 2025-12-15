import client from "./client";

export async function loginRequest(email, password) {
    const res = await client.post("/login", { email, password });
    return res.data;
}

export async function signupRequest(email, password) {
    const res = await client.post("/signup", { email, password });
    return res.data;
}
