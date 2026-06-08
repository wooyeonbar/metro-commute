"use client";

import { useEffect, useState } from "react";

type Arrival = {
  line: string;
  direction: string;
  dest: string;
  message: string;
  minutes: number | null;
  express: boolean;
};

export default function Home() {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [updated, setUpdated] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/arrival");
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setArrivals(d.arrivals.slice(0, 3));
      setUpdated(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setErr("");
      setLoaded(true);
    } catch (e: any) {
      setErr(e.message ?? "오류");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // 15초마다 갱신
    return () => clearInterval(t);
  }, []);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0b0d12",
        color: "#f5f7fa",
        fontFamily: "-apple-system, system-ui, sans-serif",
        padding: "28px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div style={{ fontSize: 15, color: "#7d8694", letterSpacing: 1 }}>
        🚇 출근길 · 다음 열차
      </div>

      {err && <div style={{ color: "#ff6b6b" }}>{err}</div>}

      {arrivals.map((a, i) => (
        <div
          key={i}
          style={{
            background: i === 0 ? "#161b26" : "transparent",
            border: "1px solid #1f2633",
            borderRadius: 16,
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: 13, color: "#7d8694", marginBottom: 6 }}>
            {a.line} · {a.dest}행{a.express ? " · ⚡급행" : ""}
          </div>
          <div style={{ fontSize: i === 0 ? 34 : 24, fontWeight: 700, lineHeight: 1.1 }}>
            {a.message}
          </div>
        </div>
      ))}

      {!arrivals.length && !err && (
        <div style={{ color: "#7d8694" }}>
          {loaded ? "지금 도착 예정 열차가 없어요" : "불러오는 중…"}
        </div>
      )}

      <div style={{ marginTop: "auto", fontSize: 12, color: "#5a6270" }}>
        업데이트 {updated} · 15초마다 자동 갱신
      </div>
    </main>
  );
}
