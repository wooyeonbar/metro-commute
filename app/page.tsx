"use client";

import { useEffect, useState } from "react";

type Arrival = {
  line: string;
  direction: string;
  dest: string;
  message: string;
  minutes: number | null;
  express: boolean;
  heading?: string;
  station?: string;
};

const LINE_COLOR: Record<string, string> = {
  "1호선": "#0052A4", "2호선": "#00A84D", "3호선": "#EF7C1C", "4호선": "#00A5DE",
  "5호선": "#996CAC", "6호선": "#CD7C2F", "7호선": "#747F00", "8호선": "#E6186C",
  "9호선": "#BDB092",
};

function Badge({ line }: { line: string }) {
  const num = line.replace("호선", "");
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 24, height: 24, borderRadius: "50%",
        background: LINE_COLOR[line] ?? "#5a6270",
        color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0,
      }}
    >
      {num.length <= 2 ? num : num.slice(0, 2)}
    </span>
  );
}

// 방향 화살표: 2호선(을지로3가 기준) 을지로4가방면 → / 을지로입구방면 ←, 그 외 상행 ↑ / 하행 ↓
function arrowOf(line: string, direction: string, heading: string): string {
  if (line === "2호선") {
    if (heading.includes("을지로4가")) return "→";
    if (heading.includes("을지로입구")) return "←";
    return direction === "내선" ? "→" : "←";
  }
  if (direction === "상행") return "↑";
  if (direction === "하행") return "↓";
  return "";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 14, color: "#7d8694", letterSpacing: 1, margin: "10px 0 2px" }}>
      {children}
    </div>
  );
}

export default function Home() {
  const [morning, setMorning] = useState<Arrival[]>([]);
  const [evening, setEvening] = useState<Arrival[]>([]);
  const [updated, setUpdated] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/arrival");
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setMorning(d.morning ?? []);
      setEvening(d.evening ?? []);
      setUpdated(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setErr("");
      setLoaded(true);
    } catch (e: any) {
      setErr(e.message ?? "오류");
    }
  }

  useEffect(() => {
    load();
    // 30초마다 갱신, 탭이 안 보일 땐 호출 안 함 (서울 API 일일 한도 보호)
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // 퇴근길: 역·호선·방면별 그룹 (각 2대)
  const groups = new Map<string, Arrival[]>();
  for (const a of evening) {
    const key = `${a.station}|${a.line}|${a.heading || a.direction}`;
    const g = groups.get(key) ?? [];
    if (g.length < 2) g.push(a);
    groups.set(key, g);
  }

  const emptyMsg = (
    <div style={{ color: "#7d8694", fontSize: 14, padding: "6px 2px" }}>
      {loaded ? "지금 도착 예정 열차가 없어요" : "불러오는 중…"}
    </div>
  );

  return (
    <main
      style={{
        minHeight: "100dvh", background: "#0b0d12", color: "#f5f7fa",
        fontFamily: "-apple-system, system-ui, sans-serif",
        padding: "24px 18px", display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      {err && <div style={{ color: "#ff6b6b" }}>{err}</div>}

      {/* ── 출근길 ── */}
      <SectionTitle>🏢 출근길 · 신당 → 을지로3가</SectionTitle>
      {morning.length
        ? morning.map((a, i) => (
            <div
              key={i}
              style={{
                background: i === 0 ? "#161b26" : "transparent",
                border: "1px solid #1f2633", borderRadius: 14, padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <Badge line={a.line} />
              <div>
                <div style={{ fontSize: 12, color: "#7d8694", marginBottom: 3 }}>
                  {a.dest}행{a.express ? " · ⚡급행" : ""}
                </div>
                <div style={{ fontSize: i === 0 ? 26 : 19, fontWeight: 700, lineHeight: 1.1 }}>
                  {a.message}
                </div>
              </div>
            </div>
          ))
        : emptyMsg}

      {/* ── 퇴근길 ── */}
      <SectionTitle>🏠 퇴근길 · 을지로3가 + 명동</SectionTitle>
      {groups.size
        ? [...groups.entries()].map(([key, arr]) => {
            const [station, , head] = key.split("|");
            return (
              <div
                key={key}
                style={{
                  border: "1px solid #1f2633", borderRadius: 14, padding: "11px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <Badge line={arr[0].line} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#7d8694", marginBottom: 3 }}>
                    {station} · {head} {arrowOf(arr[0].line, arr[0].direction, head)}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                    {arr.map((a) => a.message).join("  ·  ")}
                  </div>
                </div>
              </div>
            );
          })
        : emptyMsg}

      <div style={{ marginTop: "auto", paddingTop: 10, fontSize: 12, color: "#5a6270" }}>
        업데이트 {updated} · 30초마다 자동 갱신
      </div>
    </main>
  );
}
