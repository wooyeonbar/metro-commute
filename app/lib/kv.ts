// Upstash Redis REST 헬퍼 (env: KV_REST_API_URL, KV_REST_API_TOKEN)
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvCmd(cmd: (string | number)[]): Promise<any> {
  if (!KV_URL || !KV_TOKEN) return null;
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
    signal: typeof (AbortSignal as any).timeout === "function" ? (AbortSignal as any).timeout(5000) : undefined,
  });
  const j = await r.json();
  return j?.result;
}

export async function kvGet(key: string): Promise<string | null> {
  try { return (await kvCmd(["GET", key])) ?? null; } catch { return null; }
}

export async function kvSet(key: string, value: string, ttlSec?: number): Promise<boolean> {
  try {
    const cmd = ttlSec ? ["SET", key, value, "EX", String(ttlSec)] : ["SET", key, value];
    return (await kvCmd(cmd)) === "OK";
  } catch { return false; }
}

export async function kvPush(key: string, value: string, ttlSec?: number): Promise<void> {
  try {
    await kvCmd(["RPUSH", key, value]);
    if (ttlSec) await kvCmd(["EXPIRE", key, String(ttlSec)]);
  } catch {}
}

export async function kvList(key: string): Promise<string[]> {
  try {
    const r = await kvCmd(["LRANGE", key, 0, -1]);
    return Array.isArray(r) ? r.map(String) : [];
  } catch { return []; }
}
