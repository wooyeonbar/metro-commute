import { NextResponse } from "next/server";
import { getArrivals, Arrival } from "../../lib/metro";
import { getWeather } from "../../lib/weather";

export const dynamic = "force-dynamic";

// 실패해도 빈 배열 (한 역 실패가 전체 500으로 번지지 않게) + 1회 재시도
async function safe(fn: () => Promise<Arrival[]>): Promise<Arrival[]> {
  try {
    return await fn();
  } catch {
    try {
      return await fn();
    } catch {
      return [];
    }
  }
}

export async function GET() {
  const pmStation = process.env.STATION_PM || process.env.STATION || "";
  // 순차 호출 (동시 호출로 인한 간헐 차단 방지)
  const morning = await safe(() => getArrivals());
  const ulji = await safe(() => getArrivals({ station: pmStation, direction: null, subwayId: "" }));
  const myeong = await safe(() => getArrivals({ station: "명동", direction: null, subwayId: "" }));
  const weather = await getWeather();
  const evening = [
    ...ulji.map((a) => ({ ...a, station: pmStation })),
    ...myeong.map((a) => ({ ...a, station: "명동" })),
  ];
  return NextResponse.json({ ok: true, morning: morning.slice(0, 3), evening, weather, at: Date.now() });
}
