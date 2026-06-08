import { NextResponse } from "next/server";
import { getArrivals } from "../../lib/metro";

export const dynamic = "force-dynamic";

// 온보딩: 역 이름 → 그 역의 노선들 + 각 노선의 방향(방면) 후보
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("station")?.trim();
  if (!name) return NextResponse.json({ ok: false, error: "역 이름 필요" }, { status: 400 });
  try {
    const list = await getArrivals({ station: name, direction: null, subwayId: "" });
    const lines: Record<string, any> = {};
    for (const a of list) {
      const k = a.subwayId;
      lines[k] ??= { subwayId: k, line: a.line, dirs: {} as Record<string, any> };
      const dk = a.direction; // updnLine (상행/하행/내선/외선)
      lines[k].dirs[dk] ??= { updnLine: dk, heading: a.heading, dest: a.dest };
    }
    const result = Object.values(lines).map((l: any) => ({
      subwayId: l.subwayId, line: l.line, dirs: Object.values(l.dirs),
    }));
    return NextResponse.json({ ok: true, lines: result, empty: result.length === 0 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
