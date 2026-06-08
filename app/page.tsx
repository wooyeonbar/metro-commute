"use client";

import { useEffect, useState } from "react";

type Arrival = {
  subwayId: string; line: string; direction: string; dest: string;
  message: string; minutes: number | null; express: boolean; heading?: string; station?: string;
};
type Leg = { name: string; subwayId: string; line: string; updnLine: string; heading: string };
type Cfg = { morning: Leg[]; pmMain: string; pmSub: string };
type MorningLeg = { name: string; line: string; subwayId: string; updnLine: string; heading: string; trains: Arrival[] };

const CFG_KEY = "mc_cfg_v2";

const LINE_COLOR: Record<string, string> = {
  "1호선": "#0052A4", "2호선": "#00A84D", "3호선": "#EF7C1C", "4호선": "#00A5DE",
  "5호선": "#996CAC", "6호선": "#CD7C2F", "7호선": "#747F00", "8호선": "#E6186C",
  "9호선": "#BDB092", "경의중앙": "#77C4A3", "공항철도": "#0090D2", "경춘": "#0C8E72",
  "수인분당": "#FABE00", "신분당": "#D4003B", "우이신설": "#B7C452",
};
const lineColor = (l: string) => LINE_COLOR[l] ?? "#5a6270";

function Badge({ line }: { line: string }) {
  const num = (line || "").replace("호선", "");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 24, height: 24, padding: "0 5px", borderRadius: 12,
      background: lineColor(line), color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
      {num.length <= 2 ? num : num.slice(0, 2)}
    </span>
  );
}

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
const inputStyle = { width: "100%", boxSizing: "border-box" as const, padding: "12px 14px", fontSize: 16,
  background: "#161b26", color: "#f5f7fa", border: "1px solid #2a3340", borderRadius: 12, outline: "none" };
const btn = (bg: string) => ({ padding: "12px 16px", fontSize: 15, fontWeight: 700, color: "#fff",
  background: bg, border: "none", borderRadius: 12, cursor: "pointer" });

// ───────── 온보딩 ─────────
function Onboarding({ onDone, initial }: { onDone: (c: Cfg) => void; initial?: Cfg }) {
  type Phase = "legStation" | "legDir" | "legMore" | "pmMain" | "pmSub";
  const [phase, setPhase] = useState<Phase>("legStation");
  const [legs, setLegs] = useState<Leg[]>(initial?.morning ?? []);
  const [name, setName] = useState("");
  const [lines, setLines] = useState<any[]>([]);
  const [linesErr, setLinesErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [pick, setPick] = useState<{ subwayId: string; line: string } | null>(null);
  const [dir, setDir] = useState<{ updnLine: string; heading: string } | null>(null);
  const [pmMain, setPmMain] = useState(initial?.pmMain ?? "");
  const [pmSub, setPmSub] = useState(initial?.pmSub ?? "");

  async function fetchLines() {
    setLoading(true); setLinesErr(""); setLines([]); setPick(null); setDir(null);
    try {
      const r = await fetch("/api/lines?station=" + encodeURIComponent(name.trim()));
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      if (!d.lines.length) setLinesErr("운행 시간이 아니라 노선을 자동으로 못 불러왔어요. 운행 시간(05:30~24:00)에 다시 시도해 주세요.");
      setLines(d.lines);
      if (d.lines.length === 1) setPick({ subwayId: d.lines[0].subwayId, line: d.lines[0].line });
      setPhase("legDir");
    } catch (e: any) { setLinesErr(e.message ?? "오류"); setPhase("legDir"); }
    finally { setLoading(false); }
  }
  function addLeg() {
    setLegs([...legs, { name: name.trim(), subwayId: pick!.subwayId, line: pick!.line, updnLine: dir!.updnLine, heading: dir!.heading }]);
    setName(""); setLines([]); setPick(null); setDir(null); setPhase("legMore");
  }

  const wrap: any = { minHeight: "100dvh", background: "#0b0d12", color: "#f5f7fa",
    fontFamily: "-apple-system, system-ui, sans-serif", padding: "28px 20px",
    display: "flex", flexDirection: "column", gap: 16, maxWidth: 480, margin: "0 auto" };
  const title = (t: string, sub?: string) => (
    <div><div style={{ fontSize: 22, fontWeight: 800 }}>{t}</div>
      {sub && <div style={{ fontSize: 13, color: "#7d8694", marginTop: 6 }}>{sub}</div>}</div>
  );
  const legNo = legs.length; // 다음 추가될 구간 번호 (0=출발)
  const curLine = lines.find((l) => l.subwayId === pick?.subwayId);

  return (
    <main style={wrap}>
      <div style={{ fontSize: 13, color: "#7d8694", letterSpacing: 1 }}>🚇 출퇴근 지하철 설정</div>

      {legs.length > 0 && (phase === "legStation" || phase === "legDir" || phase === "legMore") && (
        <div style={{ ...card, padding: "10px 12px", fontSize: 13, color: "#9aa4b2" }}>
          {legs.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: i < legs.length - 1 ? 4 : 0 }}>
              <span style={{ color: "#5a6270" }}>{i === 0 ? "출발" : "환승"}</span>
              <Badge line={l.line} /> {l.name} · {l.heading || l.updnLine}
            </div>
          ))}
        </div>
      )}

      {phase === "legStation" && (
        <>
          {title(legNo === 0 ? "출발(집) 역" : `환승 ${legNo}: 갈아타는 역`,
            legNo === 0 ? "아침에 타는 역. 예: 신당, 강남" : "환승역 이름을 입력하세요.")}
          <input style={inputStyle} placeholder="역 이름" value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) fetchLines(); }} />
          <div style={{ display: "flex", gap: 8 }}>
            {legNo > 0 && <button style={btn("#222a36")} onClick={() => setPhase("legMore")}>이전</button>}
            <button style={{ ...btn(name.trim() ? "#2f6fed" : "#2a3340"), flex: 1 }} disabled={!name.trim() || loading} onClick={fetchLines}>
              {loading ? "불러오는 중…" : "다음"}</button>
          </div>
        </>
      )}

      {phase === "legDir" && (
        <>
          {title(`${name} · 노선·방면`, "탈 노선과 가는 방면을 고르세요.")}
          {linesErr && <div style={{ color: "#ffb86f", fontSize: 13 }}>{linesErr}</div>}
          {lines.length > 1 && (
            <div>
              <div style={{ fontSize: 13, color: "#7d8694", marginBottom: 8 }}>노선 선택</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {lines.map((l) => (
                  <button key={l.subwayId} onClick={() => { setPick({ subwayId: l.subwayId, line: l.line }); setDir(null); }}
                    style={{ ...btn(pick?.subwayId === l.subwayId ? lineColor(l.line) : "#222a36"), display: "flex", alignItems: "center", gap: 6 }}>
                    <Badge line={l.line} /> {l.line}</button>
                ))}
              </div>
            </div>
          )}
          {curLine && (
            <div>
              <div style={{ fontSize: 13, color: "#7d8694", margin: "12px 0 8px" }}>가는 방면 (탭)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {curLine.dirs.map((dd: any) => (
                  <button key={dd.updnLine} onClick={() => setDir({ updnLine: dd.updnLine, heading: dd.heading })}
                    style={{ ...card, padding: "12px 14px", textAlign: "left", color: "#f5f7fa", cursor: "pointer",
                      borderColor: dir?.updnLine === dd.updnLine ? lineColor(curLine.line) : "#1f2633",
                      borderWidth: dir?.updnLine === dd.updnLine ? 2 : 1 }}>
                    <b style={{ fontSize: 16 }}>{dd.heading || dd.dest + "행"}</b>
                    <span style={{ color: "#7d8694", fontSize: 12 }}>  ({dd.updnLine} · {dd.dest}행)</span></button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button style={btn("#222a36")} onClick={() => setPhase("legStation")}>이전</button>
            <button style={{ ...btn(pick && dir ? "#2f6fed" : "#2a3340"), flex: 1 }} disabled={!pick || !dir} onClick={addLeg}>이 역 추가</button>
          </div>
        </>
      )}

      {phase === "legMore" && (
        <>
          {title("출근 경로", "환승해서 한 번 더 타면 추가하세요. 다 됐으면 다음으로.")}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button style={btn("#222a36")} onClick={() => setPhase("legStation")}>+ 환승역 추가</button>
            {legs.length > 1 && <button style={btn("#3a2530")} onClick={() => setLegs(legs.slice(0, -1))}>마지막 환승 삭제</button>}
            <button style={btn(pmMainOrNext())} onClick={() => setPhase("pmMain")} {...({} as any)}>출근 경로 완료 →</button>
          </div>
        </>
      )}

      {phase === "pmMain" && (
        <>
          {title("메인 퇴근역", "평소 퇴근할 때 타는 역. 양방향·전 노선 표시.")}
          <input style={inputStyle} placeholder="역 이름 (예: 을지로3가)" value={pmMain} onChange={(e) => setPmMain(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn("#222a36")} onClick={() => setPhase("legMore")}>이전</button>
            <button style={{ ...btn(pmMain.trim() ? "#2f6fed" : "#2a3340"), flex: 1 }} disabled={!pmMain.trim()} onClick={() => setPhase("pmSub")}>다음</button>
          </div>
        </>
      )}

      {phase === "pmSub" && (
        <>
          {title("서브 퇴근역 (선택)", "다른 노선 탈 때 걸어가는 역. 없으면 비우고 완료.")}
          <input style={inputStyle} placeholder="역 이름 (예: 명동)" value={pmSub} onChange={(e) => setPmSub(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn("#222a36")} onClick={() => setPhase("pmMain")}>이전</button>
            <button style={{ ...btn("#22c55e"), flex: 1 }} disabled={!legs.length || !pmMain.trim()}
              onClick={() => onDone({ morning: legs, pmMain: pmMain.trim(), pmSub: pmSub.trim() })}>완료</button>
          </div>
        </>
      )}
    </main>
  );
  function pmMainOrNext() { return "#2f6fed"; }
}

// ───────── 메인 ─────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, color: "#7d8694", letterSpacing: 1, margin: "10px 0 2px" }}>{children}</div>;
}
function MainView({ cfg, onEdit }: { cfg: Cfg; onEdit: () => void }) {
  const [morning, setMorning] = useState<MorningLeg[]>([]);
  const [evening, setEvening] = useState<Arrival[]>([]);
  const [weather, setWeather] = useState<{ tmin: number; tmax: number; popAm: number; popPm: number; popEve: number } | null>(null);
  const [updated, setUpdated] = useState(""); const [err, setErr] = useState(""); const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const qs = new URLSearchParams({ legs: JSON.stringify(cfg.morning), pmMain: cfg.pmMain, pmSub: cfg.pmSub });
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
  const stationOrder = [cfg.pmMain, cfg.pmSub];
  const groups = [...gm.values()].sort((a, b) =>
    (stationOrder.indexOf(a.station) - stationOrder.indexOf(b.station)) || (lineNum(a.line) - lineNum(b.line)) || a.arrow.localeCompare(b.arrow));

  const empty = <div style={{ color: "#7d8694", fontSize: 14, padding: "6px 2px" }}>{loaded ? "지금 도착 예정 열차가 없어요" : "불러오는 중…"}</div>;
  const mSize = [{ font: 26, pad: "15px 16px", label: 12 }, { font: 19, pad: "11px 14px", label: 11 }, { font: 15, pad: "9px 13px", label: 11 }];
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
          <span><b style={{ color: "#6fb7ff" }}>{weather.tmin}°</b>{" / "}<b style={{ color: "#ff8a6f" }}>{weather.tmax}°</b>
            <span style={{ color: "#7d8694" }}> · 강수확률 오전 </span><b>{weather.popAm}%</b>
            <span style={{ color: "#7d8694" }}> · 오후 </span><b>{weather.popPm}%</b></span>
        </div>
      )}

      {/* 출근길: 구간별 */}
      {morning.map((leg, li) => (
        <div key={li} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SectionTitle>{li === 0 ? "🏢 출발" : "🔁 환승"} · {leg.name} {leg.heading ? `(${leg.heading})` : leg.updnLine ? `(${leg.updnLine})` : ""}</SectionTitle>
          {leg.trains.length ? leg.trains.slice(0, 3).map((a, i) => {
            const s = mSize[i] ?? mSize[2];
            return (
              <div key={i} style={{ ...card, background: i === 0 ? "#161b26" : "transparent", padding: s.pad, display: "flex", alignItems: "center", gap: 12 }}>
                <Badge line={a.line} />
                <div><div style={{ fontSize: s.label, color: "#7d8694", marginBottom: 3 }}>{a.dest}행{a.express ? " · ⚡급행" : ""}</div>
                  <div style={{ fontSize: s.font, fontWeight: 700, lineHeight: 1.1 }}>{cleanMsg(a.message)}</div></div>
              </div>
            );
          }) : empty}
        </div>
      ))}

      {/* 퇴근길 */}
      <SectionTitle>🏠 퇴근길 · {pmLabel}
        {weather ? <span style={{ color: weather.popEve >= 50 ? "#ff8a6f" : "#7d8694" }}>{`  ·  ☔ 6시 이후 ${weather.popEve}%`}</span> : null}
      </SectionTitle>
      {groups.length ? groups.map((g) => (
        <div key={g.station + g.line + g.arrow} style={{ ...card, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 26, fontSize: 22, fontWeight: 800, textAlign: "center", flexShrink: 0, lineHeight: 1 }}>{g.arrow}</span>
          <Badge line={g.line} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#7d8694", marginBottom: 3 }}>{g.station} · {g.heading}</div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{g.arr.map((a) => cleanMsg(a.message)).join("  ·  ")}</div></div>
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
    try {
      const raw = localStorage.getItem(CFG_KEY);
      if (raw) { setCfg(JSON.parse(raw)); }
      else {
        const old = localStorage.getItem("mc_cfg_v1"); // v1 → v2 마이그레이션
        if (old) {
          const o = JSON.parse(old);
          if (o?.home) {
            const mig: Cfg = { morning: [{ name: o.home.name, subwayId: o.home.subwayId, line: o.home.line, updnLine: o.dir?.updnLine ?? "", heading: o.dir?.heading ?? "" }], pmMain: o.pmMain ?? "", pmSub: o.pmSub ?? "" };
            localStorage.setItem(CFG_KEY, JSON.stringify(mig)); setCfg(mig);
          }
        }
      }
    } catch {}
    setReady(true);
  }, []);

  if (!ready) return <main style={{ minHeight: "100dvh", background: "#0b0d12" }} />;
  if (!cfg || editing) {
    return <Onboarding initial={cfg ?? undefined} onDone={(c) => {
      try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch {}
      setCfg(c); setEditing(false);
    }} />;
  }
  return <MainView cfg={cfg} onEdit={() => setEditing(true)} />;
}
