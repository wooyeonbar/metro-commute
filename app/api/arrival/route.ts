import { NextResponse } from "next/server";
import { getArrivals } from "../../lib/metro";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const arrivals = await getArrivals();
    return NextResponse.json({ ok: true, arrivals, at: Date.now() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
