// 서울(중구, nx=60 ny=127) 오늘 날씨 — 기상청 단기예보 (네이버와 동일 출처)
// 필요 env: KMA_API_KEY (공공데이터포털 일반 인증키 Decoding)

export type Weather = { tmin: number; tmax: number; popAm: number; popPm: number };

let cache: { at: number; data: Weather } | null = null;

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

export async function getWeather(): Promise<Weather | null> {
  if (cache && Date.now() - cache.at < 30 * 60 * 1000) return cache.data;
  const key = process.env.KMA_API_KEY;
  if (!key) return null;
  try {
    const kst = kstNow();
    const today = kst.toISOString().slice(0, 10).replace(/-/g, "");
    // 02시 발표분에 오늘 TMN/TMX/시간별 POP이 모두 포함됨 (02시 이전이면 어제 23시 발표분)
    let baseDate = today;
    let baseTime = "0200";
    if (kst.getUTCHours() < 2) {
      const y = new Date(kst.getTime() - 24 * 60 * 60 * 1000);
      baseDate = y.toISOString().slice(0, 10).replace(/-/g, "");
      baseTime = "2300";
    }
    const url =
      "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst" +
      `?serviceKey=${encodeURIComponent(key)}&dataType=JSON&numOfRows=400&pageNo=1` +
      `&base_date=${baseDate}&base_time=${baseTime}&nx=60&ny=127`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: typeof (AbortSignal as any).timeout === "function" ? (AbortSignal as any).timeout(8000) : undefined,
    });
    const d = await res.json();
    const items: any[] = d?.response?.body?.items?.item ?? [];
    const todayItems = items.filter((it) => it.fcstDate === today);
    const num = (c: string) => {
      const v = todayItems.find((it) => it.category === c)?.fcstValue;
      return v !== undefined ? Math.round(parseFloat(v)) : null;
    };
    const pops = (from: number, to: number) =>
      Math.max(
        0,
        ...todayItems
          .filter((it) => it.category === "POP" && +it.fcstTime.slice(0, 2) >= from && +it.fcstTime.slice(0, 2) < to)
          .map((it) => +it.fcstValue)
      );
    const tmin = num("TMN");
    const tmax = num("TMX");
    if (tmin === null || tmax === null) return cache?.data ?? null;
    const data: Weather = { tmin, tmax, popAm: pops(0, 12), popPm: pops(12, 24) };
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
