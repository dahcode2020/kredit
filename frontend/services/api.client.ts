// Central fetcher — JWT + idempotency + correlation
export async function apiFetch(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  const headers: Record<string,string> = {
    "Content-Type":"application/json",
    ...(init.headers as any),
    "x-request-id": crypto.randomUUID(),
  };
  if (init.idempotencyKey) headers["x-idempotency-key"] = init.idempotencyKey;
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(()=> ({}));
    throw new Error(body.message || `API ${res.status}`);
  }
  return res.json();
}
