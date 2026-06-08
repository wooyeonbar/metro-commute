import { NextResponse } from "next/server";
import { getArrivals, Arrival } from "../../lib/metro";
import { getWeather } from "../../lib/weather";

export const dynamic = "force-dynamic";

async function safe(fn: () => Promise<Arrival[]>): Promise<Arrival[]> {
  try { return await fn(); }
  catch { try { return await fn(); } catch { return []; } }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const home = q.get("home")?.trim();
  const weather = await getWeather();

  let morning: Arrival[];
  let evStations: string[];
  let lists: Arrival[][];

  if (home) {
    // 사용자 설정 기반
    const homeSub = q.get("homeSub") || "";
    const homeDir = q.get("homeDir") || undefined;
    const pmMain = q.get("pmMain")?.trim() || "";
    const pmSub = q.get("pmSub")?.trim() || "";
    morning = await safe(() => getArrivals({ station: home, subwayId: homeSub, direction: homeDir }));
    evStations = [pmMain, pmSub].filter(Boolean) as string[];
    lists = await Promise.all(evStations.map((s) => safe(() => getArrivals({ station: s, direction: null, subwayId: "" }))));
  } else {
    // env 폴백 (사이트 주인 기본값 — 텔레그램과 동일)
    const pmStation = process.env.STATION_PM || process.env.STATION || "";
    morning = await safe(() => getArrivals());
    evStations = [pmStation, "명동"];
    lists = await Promise.all(evStations.map((s) => safe(() => getArrivals({ station: s, direction: null, subwayId: "" }))));
  }

  const evening = evStations.flatMap((st, i) => lists[i].map((a) => ({ ...a, station: st })));
  return NextResponse.json({ ok: true, morning: morning.slice(0, 3), evening, weather, at: Date.now() });
}
