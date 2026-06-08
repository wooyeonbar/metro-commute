"use client";

import { useEffect, useState } from "react";

type Arrival = {
  subwayId: string;
  line: string;
  direction: string;
  dest: string;
  message: string;
  minutes: number | null;
  express: boolean;
  heading?: string;
  station?: string;
};

type Cfg = {
  home: { name: string; subwayId: string; line: string };
  dir: { updnLine: string; heading: string };
  pmMain: string;
  pmSub: string;
};

const CFG_KEY = "mc_cfg_v1";

const LINE_COLOR: Record<string, string> = {
  "1호선": "#0052A4", "2호선": "#00A84D", "3호선": "#EF7C1C", "4호선": "#00A5DE",
  "5호선": "#996CAC", "6호선": "#CD7C2F", "7호선": "#747F00", "8호선": "#E6186C",
  "9호선": "#BDB092", "경의중앙": "#77C4A3", "공항철도": "#0090D2", "경춘": "#0C8E72",
  "수인분당": "#FABE00", "신분당": "#D4003B", "우이신설": "#B7C452",
};

function lineColor(line: string) { return LINE_COLOR[line] ?? "#5a6270"; }

function Badge({ line }: { line: string }) {
  const num = line.replace("호선", "");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 24, height: 24, padding: "0 5px", borderRadius: 12,
      background: lineColor(line), color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0,
    }}>
      {num.length <= 2 ? num : num.slice(0, 2)}
    </span>
  );
}

// 방향 화살표: 2호선 을지로4가방면→/을지로입구방면←, 그 외 내선↺/외선↻, 상행↑/하행↓
function arrowOf(line: string, direction: string, heading: string): string {
  if (line === "2호선") {
    if (heading?.includes("을지로4가")) return "→";
    if (heading?.includes("을지로입구")) return "←";
    return direction === "내선" ? "↺" : "↻";
  }
  if (direction === "상행") return "↑";
  if (direction === "하행") return "↓";
  if (direction === "내선") return "↺";
  if (direction === "외선") return "↻";
  return "·";
}

function cleanMsg(message: string): string {
  const m = (message || "").replace(/\s*\([^)]*\)/g, "").trim();
  if (/분|초/.test(m)) return m;
  if (/도착|진입|출발/.test(m)) return "곧 도착";
  return m || "정보 없음";
}

const card = { border: "1px solid #1f2633", borderRadius: 14, background: "#0f131b" } as const;
const inputStyle = {
  width: "100%", boxSizing: "border-box" as const, padding: "12px 14px", fontSize: 16,
  background: "#161b26", color: "#f5f7fa", border: "1px solid #2a3340", borderRadius: 12, outline: "none",
};
const btn = (bg: string) => ({
  padding: "12px 16px", fontSize: 15, fontWeight: 700, color: "#fff",
  background: bg, border: "none", borderRadius: 12, cursor: "pointer",
});

// ───────────────────────── 온보딩 ─────────────────────────
function Onboarding({ onDone, initial }: { onDone: (c: Cfg) => void; initial?: Cfg }) {
  const [step, setStep] = useState(0);
  const [homeName, setHomeName] = useState(initial?.home.name ?? "");
  const [lines, setLines] = useState<any[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [linesErr, setLinesErr] = useState("");
  const [pick, setPick] = useState<{ subwayId: string; line: string } | null>(null);
  const [dir, setDir] = useState<{ updnLine: string; heading: string } | null>(null);
  const [pmMain, setPmMain] = useState(initial?.pmMain ?? "");
  const [pmSub, setPmSub] = useState(initial?.pmSub ?? "");

  async function fetchLines() {
    setLoadingLines(true); setLinesErr(""); setLines([]); setPick(null); setDir(null);
    try {
      const r = await fetch("/api/lines?station=" + encodeURIComponent(homeName.trim()));
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      if (!d.lines.length) { setLinesErr("열차 운행 시간이 아니라 노선을 자동으로 못 불러왔어요. 운행 시간(05:30~24:00)에 다시 시도해 주세요."); }
      setLines(d.lines);
      if (d.lines.length === 1) setPick({ subwayId: d.lines[0].subwayId, line: d.lines[0].line });
      setStep(1);
    } catch (e: any) { setLinesErr(e.message ?? "오류"); setStep(1); }
    finally { setLoadingLines(false); }
  }

  const wrap: any = { minHeight: "100dvh", background: "#0b0d12", color: "#f5f7fa",
    fontFamily: "-apple-system, system-ui, sans-serif", padding: "28px 20px",
    display: "flex", flexDirection: "column", gap: 16, maxWidth: 480, margin: "0 auto" };
  const title = (t: string, sub?: string) => (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{t}</div>
      {sub && <div style={{ fontSize: 13, color: "#7d8694", marginTop: 6 }}>{sub}</div>}
    </div>
  );
  const curLine = lines.find((l) => l.subwayId === pick?.subwayId);

  return (
    <main style={wrap}>
      <div style={{ fontSize: 13, color: "#7d8694", letterSpacing: 1 }}>🚇 출퇴근 지하철 설정 · {step + 1}/4</div>

      {step === 0 && (
        <>
          {title("출발(집) 역", "아침에 타는 역 이름을 입력하세요. 예: 신당, 강남")}
          <input style={inputStyle} placeholder="역 이름 (예: 신당)" value={homeName}
            onChange={(e) => setHomeName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && homeName.trim()) fetchLines(); }} />
          <button style={btn(homeName.trim() ? "#2f6fed" : "#2a3340")} disabled={!homeName.trim() || loadingLines}
            onClick={fetchLines}>{loadingLines ? "불러오는 중…" : "다음"}</button>
        </>
      )}

      {step === 1 && (
        <>
          {title(`${homeName} · 노선·방향`, "타는 노선과 회사 가는 방면을 고르세요.")}
          {linesErr && <div style={{ color: "#ffb86f", fontSize: 13 }}>{linesErr}</div>}
          {lines.length > 1 && (
            <div>
              <div style={{ fontSize: 13, color: "#7d8694", marginBottom: 8 }}>노선 선택</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {lines.map((l) => (
                  <button key={l.subwayId} onClick={() => { setPick({ subwayId: l.subwayId, line: l.line }); setDir(null); }}
                    style={{ ...btn(pick?.subwayId === l.subwayId ? lineColor(l.line) : "#222a36"), display: "flex", alignItems: "center", gap: 6 }}>
                    <Badge line={l.line} /> {l.line}
                  </button>
                ))}
              </div>
            </div>
          )}
          {curLine && (
            <div>
              <div style={{ fontSize: 13, color: "#7d8694", margin: "12px 0 8px" }}>회사 가는 방면 (탭)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {curLine.dirs.map((dd: any) => (
                  <button key={dd.updnLine} onClick={() => setDir({ updnLine: dd.updnLine, heading: dd.heading })}
                    style={{ ...card, padding: "12px 14px", textAlign: "left", color: "#f5f7fa", cursor: "pointer",
                      borderColor: dir?.updnLine === dd.updnLine ? lineColor(curLine.line) : "#1f2633",
                      borderWidth: dir?.updnLine === dd.updnLine ? 2 : 1 }}>
                    <b style={{ fontSize: 16 }}>{dd.heading || dd.dest + "행"}</b>
                    <span style={{ color: "#7d8694", fontSize: 12 }}>  ({dd.updnLine} · {dd.dest}행)</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button style={btn("#222a36")} onClick={() => setStep(0)}>이전</button>
            <button style={{ ...btn(pick && dir ? "#2f6fed" : "#2a3340"), flex: 1 }} disabled={!pick || !dir}
              onClick={() => setStep(2)}>다음</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          {title("메인 퇴근역", "평소 퇴근할 때 타는 역. 양방향·전 노선이 표시돼요.")}
          <input style={inputStyle} placeholder="역 이름 (예: 을지로3가)" value={pmMain}
            onChange={(e) => setPmMain(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn("#222a36")} onClick={() => setStep(1)}>이전</button>
            <button style={{ ...btn(pmMain.trim() ? "#2f6fed" : "#2a3340"), flex: 1 }} disabled={!pmMain.trim()}
              onClick={() => setStep(3)}>다음</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          {title("서브 퇴근역 (선택)", "다른 노선 탈 때 걸어가는 역이 있으면 입력. 없으면 건너뛰기.")}
          <input style={inputStyle} placeholder="역 이름 (예: 명동) — 없으면 비워두세요" value={pmSub}
            onChange={(e) => setPmSub(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn("#222a36")} onClick={() => setStep(2)}>이전</button>
            <button style={{ ...btn("#22c55e"), flex: 1 }}
              onClick={() => onDone({
                home: { name: homeName.trim(), subwayId: pick!.subwayId, line: pick!.line },
                dir: dir!, pmMain: pmMain.trim(), pmSub: pmSub.trim(),
              })}>완료</button>
          </div>
        </>
      )}
    </main>
  );
}

// ───────────────────────── 메인 ─────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, color: "#7d8694", letterSpacing: 1, margin: "10px 0 2px" }}>{children}</div>;
}

function Home({ cfg, onEdit }: { cfg: Cfg; onEdit: () => void }) {
  const [morning, setMorning] = useState<Arrival[]>([]);
  const [evening, setEvening] = useState<Arrival[]>([]);
  const [weather, setWeather] = useState<{ tmin: number; tmax: number; popAm: number; popPm: number; popEve: number } | null>(null);
  const [updated, setUpdated] = useState("");
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const qs = new URLSearchParams({
        home: cfg.home.name, homeSub: cfg.home.subwayId, homeDir: cfg.dir.updnLine,
        pmMain: cfg.pmMain, pmSub: cfg.pmSub,
      });
      const r = await fetch("/api/arrival?" + qs.toString());
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setMorning(d.morning ?? []); setEvening(d.evening ?? []); setWeather(d.weather ?? null);
      setUpdated(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setErr(""); setLoaded(true);
    } catch (e: any) { setErr(e.message ?? "오류"); }
  }
  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 30000);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  // 퇴근길: 역·노선·방향 그룹 (각 3대), 노선번호+방향 순 정렬
  type G = { arrow: string; line: string; heading: string; station: string; arr: Arrival[] };
  const gm = new Map<string, G>();
  for (const a of evening) {
    const arrow = arrowOf(a.line, a.direction, a.heading ?? "");
    const key = `${a.station}|${a.line}|${arrow}`;
    const g = gm.get(key) ?? { arrow, line: a.line, heading: a.heading || a.direction, station: a.station ?? "", arr: [] };
    if (g.arr.length < 3) g.arr.push(a);
    gm.set(key, g);
  }
  const lineNum = (l: string) => parseInt(l) || 99;
  const groups = [...gm.values()].sort((a, b) =>
    a.station === b.station ? (lineNum(a.line) - lineNum(b.line) || a.arrow.localeCompare(b.arrow)) : 0
  );

  const empty = <div style={{ color: "#7d8694", fontSize: 14, padding: "6px 2px" }}>{loaded ? "지금 도착 예정 열차가 없어요" : "불러오는 중…"}</div>;
  const mSize = [{ font: 28, pad: "16px 18px", label: 12 }, { font: 20, pad: "12px 16px", label: 11 }, { font: 16, pad: "10px 14px", label: 11 }];
  const pmLabel = cfg.pmMain + (cfg.pmSub ? " + " + cfg.pmSub : "");

  return (
    <main style={{ minHeight: "100dvh", background: "#0b0d12", color: "#f5f7fa",
      fontFamily: "-apple-system, system-ui, sans-serif", padding: "24px 18px",
      display: "flex", flexDirection: "column", gap: 10, maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onEdit} style={{ background: "none", border: "none", color: "#7d8694", fontSize: 13, cursor: "pointer" }}>⚙ 역 설정</button>
      </div>
      {err && <div style={{ color: "#ff6b6b" }}>{err}</div>}

      {weather && (
        <div style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
          <span style={{ fontSize: 18 }}>{Math.max(weather.popAm, weather.popPm) >= 50 ? "☔" : "🌤"}</span>
          <span>
            <b style={{ color: "#6fb7ff" }}>{weather.tmin}°</b>{" / "}<b style={{ color: "#ff8a6f" }}>{weather.tmax}°</b>
            <span style={{ color: "#7d8694" }}> · 강수확률 오전 </span><b>{weather.popAm}%</b>
            <span style={{ color: "#7d8694" }}> · 오후 </span><b>{weather.popPm}%</b>
          </span>
        </div>
      )}

      <SectionTitle>🏢 출근길 · {cfg.home.name} ({cfg.dir.heading || cfg.dir.updnLine})</SectionTitle>
      {morning.length ? morning.slice(0, 3).map((a, i) => {
        const s = mSize[i] ?? mSize[2];
        return (
          <div key={i} style={{ ...card, background: i === 0 ? "#161b26" : "transparent", padding: s.pad, display: "flex", alignItems: "center", gap: 12 }}>
            <Badge line={a.line} />
            <div>
              <div style={{ fontSize: s.label, color: "#7d8694", marginBottom: 3 }}>{a.dest}행{a.express ? " · ⚡급행" : ""}</div>
              <div style={{ fontSize: s.font, fontWeight: 700, lineHeight: 1.1 }}>{cleanMsg(a.message)}</div>
            </div>
          </div>
        );
      }) : empty}

      <SectionTitle>
        🏠 퇴근길 · {pmLabel}
        {weather ? <span style={{ color: weather.popEve >= 50 ? "#ff8a6f" : "#7d8694" }}>{`  ·  ☔ 6시 이후 ${weather.popEve}%`}</span> : null}
      </SectionTitle>
      {groups.length ? groups.map((g) => (
        <div key={g.station + g.line + g.arrow} style={{ ...card, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 26, fontSize: 22, fontWeight: 800, textAlign: "center", flexShrink: 0, lineHeight: 1 }}>{g.arrow}</span>
          <Badge line={g.line} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#7d8694", marginBottom: 3 }}>{g.station} · {g.heading}</div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{g.arr.map((a) => cleanMsg(a.message)).join("  ·  ")}</div>
          </div>
        </div>
      )) : empty}

      <div style={{ marginTop: "auto", paddingTop: 10, fontSize: 12, color: "#5a6270" }}>업데이트 {updated} · 30초마다 자동 갱신</div>
    </main>
  );
}

export default function Page() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(CFG_KEY); if (raw) setCfg(JSON.parse(raw)); } catch {}
    setReady(true);
  }, []);

  if (!ready) return <main style={{ minHeight: "100dvh", background: "#0b0d12" }} />;

  if (!cfg || editing) {
    return <Onboarding initial={cfg ?? undefined} onDone={(c) => {
      try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch {}
      setCfg(c); setEditing(false);
    }} />;
  }
  return <Home cfg={cfg} onEdit={() => setEditing(true)} />;
}
