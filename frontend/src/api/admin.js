import client from "./client";

export async function retrainModel() {
    const res = await client.post("/api/model/reload");
    return res.data;
}
