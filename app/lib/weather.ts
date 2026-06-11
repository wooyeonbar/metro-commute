// 서울(중구, nx=60 ny=127) 오늘 날씨 — 기상청 단기예보 (네이버와 동일 출처)
// 기온은 02시 발표분, 강수확률(POP)은 '최신 발표분'으로 덮어써 실시간 반영
// 필요 env: KMA_API_KEY (공공데이터포털 일반 인증키 Decoding)

export type Weather = { tmin: number; tmax: number; popAm: number; popPm: number; popEve: number };

let cache: { at: number; data: Weather } | null = null;
function kstNow() { return new Date(Date.now() + 9 * 60 * 60 * 1000); }

// 기상청 발표시각 (분 단위). 발표 후 약 45분 뒤 제공.
const SLOTS = [120, 320, 500, 800, 1100, 1400, 1700, 2000, 2300]; // hhmm은 따로 계산
const BASE_TIMES = ["0200", "0500", "0800", "1100", "1400", "1700", "2000", "2300"];

async function fetchToday(key: string, baseDate: string, baseTime: string, today: string): Promise<any[]> {
  const url =
    "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst" +
    `?serviceKey=${encodeURIComponent(key)}&dataType=JSON&numOfRows=800&pageNo=1` +
    `&base_date=${baseDate}&base_time=${baseTime}&nx=60&ny=127`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: typeof (AbortSignal as any).timeout === "function" ? (AbortSignal as any).timeout(8000) : undefined,
  });
  const d = await res.json();
  const items: any[] = d?.response?.body?.items?.item ?? [];
  return items.filter((it) => it.fcstDate === today);
}

export async function getWeather(): Promise<Weather | null> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.data;
  const key = process.env.KMA_API_KEY;
  if (!key) return null;
  try {
    const kst = kstNow();
    const today = kst.toISOString().slice(0, 10).replace(/-/g, "");
    const yday = new Date(kst.getTime() - 86400000).toISOString().slice(0, 10).replace(/-/g, "");
    const nowMin = kst.getUTCHours() * 60 + kst.getUTCMinutes();

    // 최신 발표시각 선택 (발표 + 45분 뒤 제공)
    const slotMin = [120, 300, 480, 660, 840, 1020, 1200, 1380]; // 02,05,08,11,14,17,20,23시
    let idx = -1;
    for (let i = 0; i < slotMin.length; i++) if (nowMin >= slotMin[i] + 45) idx = i;
    let latestDate = today, latestTime = "0200";
    if (idx < 0) { latestDate = yday; latestTime = "2300"; }
    else latestTime = BASE_TIMES[idx];

    // 02시 발표(기온/오전POP) + 최신 발표(최신POP) 병합
    const needLatest = !(latestDate === today && latestTime === "0200");
    const [base0200, baseLatest] = await Promise.all([
      fetchToday(key, today, "0200", today).catch(() => [] as any[]),
      needLatest ? fetchToday(key, latestDate, latestTime, today).catch(() => [] as any[]) : Promise.resolve(null),
    ]);

    // 기온: 02시 발표 우선, 없으면 최신/캐시
    const tempSrc = base0200.length ? base0200 : (baseLatest || []);
    const num = (c: string, src: any[]) => {
      const v = src.find((it) => it.category === c)?.fcstValue;
      return v !== undefined ? Math.round(parseFloat(v)) : null;
    };
    let tmin = num("TMN", tempSrc);
    let tmax = num("TMX", tempSrc);
    if (tmin === null && cache) tmin = cache.data.tmin;
    if (tmax === null && cache) tmax = cache.data.tmax;
    if (tmin === null || tmax === null) return cache?.data ?? null;

    // POP: 02시 발표로 채우고 최신 발표로 덮어쓰기 (시각별)
    const popMap: Record<string, number> = {};
    for (const it of tempSrc) if (it.category === "POP") popMap[it.fcstTime] = +it.fcstValue;
    if (baseLatest) for (const it of baseLatest) if (it.category === "POP") popMap[it.fcstTime] = +it.fcstValue;
    const popRange = (from: number, to: number) => {
      const vals = Object.entries(popMap)
        .filter(([t]) => { const h = +t.slice(0, 2); return h >= from && h < to; })
        .map(([, v]) => v);
      return vals.length ? Math.max(...vals) : 0;
    };

    const data: Weather = { tmin, tmax, popAm: popRange(0, 12), popPm: popRange(12, 24), popEve: popRange(18, 24) };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return cache?.data ?? null;
  }
}

export function fmtWeather(w: Weather | null): string {
  if (!w) return "";
  const rain = Math.max(w.popAm, w.popPm) >= 50 ? "☔" : "💧";
  return `🌡 ${w.tmin}° / ${w.tmax}° · ${rain} 강수확률 오전 ${w.popAm}% · 오후 ${w.popPm}%`;
}
