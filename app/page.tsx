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

// 열차 위치 정보 제거, 도착 시점만 표시
function cleanMsg(message: string): string {
  const m = message.replace(/\s*\([^)]*\)/g, "").trim();
  if (/분|초/.test(m)) return m;          // "3분 30초 후" 류는 그대로
  if (/도착|진입|출발/.test(m)) return "곧 도착"; // "OO 도착/진입/출발" → 곧 도착
  return m;
}

// 퇴근길 고정 순서: 2호선← , 2호선→ , 3호선↑ , 3호선↓ , 4호선↑ , 4호선↓
function orderOf(line: string, arrow: string): number {
  const order: Record<string, number> = {
    "2호선←": 0, "2호선→": 1,
    "3호선↑": 2, "3호선↓": 3,
    "4호선↑": 4, "4호선↓": 5,
  };
  return order[line + arrow] ?? 9;
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
  const [weather, setWeather] = useState<{ tmin: number; tmax: number; popAm: number; popPm: number; popEve: number } | null>(null);
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
      setWeather(d.weather ?? null);
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

  // 퇴근길: 호선·방향별 그룹 (각 3대), 고정 순서 정렬
  type Group = { arrow: string; line: string; heading: string; station: string; arr: Arrival[] };
  const groupMap = new Map<string, Group>();
  for (const a of evening) {
    const arrow = arrowOf(a.line, a.direction, a.heading ?? "");
    const key = `${a.station}|${a.line}|${arrow}`;
    const g = groupMap.get(key) ?? {
      arrow, line: a.line, heading: a.heading || a.direction, station: a.station ?? "", arr: [],
    };
    if (g.arr.length < 3) g.arr.push(a);
    groupMap.set(key, g);
  }
  const groups = [...groupMap.values()].sort(
    (a, b) => orderOf(a.line, a.arrow) - orderOf(b.line, b.arrow)
  );

  const emptyMsg = (
    <div style={{ color: "#7d8694", fontSize: 14, padding: "6px 2px" }}>
      {loaded ? "지금 도착 예정 열차가 없어요" : "불러오는 중…"}
    </div>
  );

  // 출근길 카드 크기: 전(큼) → 전전(중간) → 전전전(작음)
  const mSize = [
    { font: 28, pad: "16px 18px", label: 12 },
    { font: 20, pad: "12px 16px", label: 11 },
    { font: 16, pad: "10px 14px", label: 11 },
  ];

  return (
    <main
      style={{
        minHeight: "100dvh", background: "#0b0d12", color: "#f5f7fa",
        fontFamily: "-apple-system, system-ui, sans-serif",
        padding: "24px 18px", display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      {err && <div style={{ color: "#ff6b6b" }}>{err}</div>}

      {/* ── 오늘 날씨 ── */}
      {weather && (
        <div
          style={{
            border: "1px solid #1f2633", borderRadius: 14, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10, fontSize: 14,
          }}
        >
          <span style={{ fontSize: 18 }}>{Math.max(weather.popAm, weather.popPm) >= 50 ? "☔" : "🌤"}</span>
          <span>
            <b style={{ color: "#6fb7ff" }}>{weather.tmin}°</b>
            {" / "}
            <b style={{ color: "#ff8a6f" }}>{weather.tmax}°</b>
            <span style={{ color: "#7d8694" }}> · 강수확률 오전 </span>
            <b>{weather.popAm}%</b>
            <span style={{ color: "#7d8694" }}> · 오후 </span>
            <b>{weather.popPm}%</b>
          </span>
        </div>
      )}

      {/* ── 출근길 ── */}
      <SectionTitle>🏢 출근길 · 신당 → 을지로3가</SectionTitle>
      {morning.length
        ? morning.slice(0, 3).map((a, i) => {
            const s = mSize[i] ?? mSize[2];
            return (
              <div
                key={i}
                style={{
                  background: i === 0 ? "#161b26" : "transparent",
                  border: "1px solid #1f2633", borderRadius: 14, padding: s.pad,
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <Badge line={a.line} />
                <div>
                  <div style={{ fontSize: s.label, color: "#7d8694", marginBottom: 3 }}>
                    {a.dest}행{a.express ? " · ⚡급행" : ""}
                  </div>
                  <div style={{ fontSize: s.font, fontWeight: 700, lineHeight: 1.1 }}>
                    {cleanMsg(a.message)}
                  </div>
                </div>
              </div>
            );
          })
        : emptyMsg}

      {/* ── 퇴근길 ── */}
      <SectionTitle>
        🏠 퇴근길 · 을지로3가 + 명동
        {weather ? <span style={{ color: weather.popEve >= 50 ? "#ff8a6f" : "#7d8694" }}>{`  ·  ☔ 6시 이후 ${weather.popEve}%`}</span> : null}
      </SectionTitle>
      {groups.length
        ? groups.map((g) => (
            <div
              key={g.station + g.line + g.arrow}
              style={{
                border: "1px solid #1f2633", borderRadius: 14, padding: "11px 14px",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <span
                style={{
                  width: 26, fontSize: 22, fontWeight: 800, textAlign: "center",
                  flexShrink: 0, lineHeight: 1,
                }}
              >
                {g.arrow}
              </span>
              <Badge line={g.line} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "#7d8694", marginBottom: 3 }}>
                  {g.station} · {g.heading}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                  {g.arr.map((a) => cleanMsg(a.message)).join("  ·  ")}
                </div>
              </div>
            </div>
          ))
        : emptyMsg}

      <div style={{ marginTop: "auto", paddingTop: 10, fontSize: 12, color: "#5a6270" }}>
        업데이트 {updated} · 30초마다 자동 갱신
      </div>
    </main>
  );
}
