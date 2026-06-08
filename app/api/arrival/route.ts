import { NextResponse } from "next/server";
import { getArrivals } from "../../lib/metro";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pmStation = process.env.STATION_PM || process.env.STATION || "";
    const [morning, ulji, myeong] = await Promise.all([
      getArrivals(), // 출근: env STATION/SUBWAY_ID/DIRECTION (신당 2호선 외선)
      getArrivals({ station: pmStation, direction: null, subwayId: "" }), // 을지로3가 2·3호선 전방향
      getArrivals({ station: "명동", direction: null, subwayId: "" }),    // 명동 4호선 전방향
    ]);
    const evening = [
      ...ulji.map((a) => ({ ...a, station: pmStation })),
      ...myeong.map((a) => ({ ...a, station: "명동" })),
    ];
    return NextResponse.json({ ok: true, morning: morning.slice(0, 3), evening, at: Date.now() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
