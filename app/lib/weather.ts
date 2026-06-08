// 서울(중구) 오늘 날씨: 최저/최고기온, 강수확률 (Open-Meteo, API 키 불필요)

export type Weather = { tmin: number; tmax: number; pop: number };

let cache: { at: number; data: Weather } | null = null;

export async function getWeather(): Promise<Weather | null> {
  // 10분 캐시 (날씨는 자주 안 바뀜)
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.data;
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=37.5610&longitude=126.9996" +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&timezone=Asia%2FSeoul&forecast_days=1";
    const res = await fetch(url, {
      cache: "no-store",
      signal: typeof (AbortSignal as any).timeout === "function" ? (AbortSignal as any).timeout(8000) : undefined,
    });
    const d = await res.json();
    const data: Weather = {
      tmax: Math.round(d.daily.temperature_2m_max[0]),
      tmin: Math.round(d.daily.temperature_2m_min[0]),
      pop: Math.round(d.daily.precipitation_probability_max[0]),
    };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return cache?.data ?? null; // 실패 시 이전 캐시라도
  }
}

export function fmtWeather(w: Weather | null): string {
  if (!w) return "";
  const rain = w.pop >= 50 ? "☔" : "💧";
  return `🌡 ${w.tmin}° / ${w.tmax}° · ${rain} 강수확률 ${w.pop}%`;
}
