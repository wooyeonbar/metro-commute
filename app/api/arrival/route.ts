import { NextResponse } from "next/server";
import { getArrivals, Arrival } from "../../lib/metro";
import { getWeather } from "../../lib/weather";

export const dynamic = "force-dynamic";

async function safe(fn: () => Promise<Arrival[]>): Promise<Arrival[]> {
  try { return await fn(); }
  catch { try { return await fn(); } catch { return []; } }
}

type Leg = { name: string; subwayId?: string; line?: string; updnLine?: string; heading?: string };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const weather = await getWeather();

  // 출근 구간(legs) 파싱: 우선 legs(JSON) → home(단일) → env 폴백
  let legs: Leg[] = [];
  const legsParam = q.get("legs");
  if (legsParam) { try { legs = JSON.parse(legsParam); } catch { legs = []; } }
  else if (q.get("home")?.trim()) {
    legs = [{ name: q.get("home")!.trim(), subwayId: q.get("homeSub") || "", updnLine: q.get("homeDir") || "", line: "", heading: "" }];
  }

  let pmMain = q.get("pmMain")?.trim() || "";
  let pmSub = q.get("pmSub")?.trim() || "";
  if (!legs.length) {
    // env 폴백 (사이트 주인 기본값 — 텔레그램과 동일)
    legs = [{ name: process.env.STATION || "", subwayId: process.env.SUBWAY_ID || "", updnLine: process.env.DIRECTION || "", line: "", heading: "" }];
    pmMain = process.env.STATION_PM || process.env.STATION || "";
    pmSub = "명동";
  }

  // 출근: 각 구간별 도착정보
  const legLists = await Promise.all(
    legs.map((l) => safe(() => getArrivals({ station: l.name, subwayId: l.subwayId || "", direction: l.updnLine || undefined })))
  );
  const morning = legs.map((l, i) => ({
    name: l.name, line: l.line || legLists[i][0]?.line || "", subwayId: l.subwayId || "",
    updnLine: l.updnLine || "", heading: l.heading || "", trains: legLists[i].slice(0, 3),
  }));

  // 퇴근: 메인/서브역 전 노선·방향
  const evStations = [pmMain, pmSub].filter(Boolean) as string[];
  const evLists = await Promise.all(evStations.map((s) => safe(() => getArrivals({ station: s, direction: null, subwayId: "" }))));
  const evening = evStations.flatMap((st, i) => evLists[i].map((a) => ({ ...a, station: st })));

  return NextResponse.json({ ok: true, morning, evening, weather, at: Date.now() });
}
