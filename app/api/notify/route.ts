import { NextResponse } from "next/server";
import { getArrivals, Arrival } from "../../lib/metro";

export const dynamic = "force-dynamic";

// 한국시간 기준 현재 상태 판단
function nowKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return { day: kst.getUTCDay(), hour: kst.getUTCHours() }; // day 0=일~6=토
}

function fmt(arr: Arrival[]) {
  return arr.length
    ? arr.map((a, i) => `${i + 1}. [${a.line}] ${a.message}${a.express ? " ⚡급행" : ""} → ${a.dest}행`).join("\n")
    : "도착 정보 없음";
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { day, hour } = nowKST();
  const weekday = day >= 1 && day <= 5;
  if (!weekday) return NextResponse.json({ ok: true, skipped: "주말" });

  const morning = hour >= 7 && hour <= 9;   // 출근: 회사 방향만
  const evening = hour >= 17 && hour <= 20;  // 퇴근: 양방향
  if (!morning && !evening) return NextResponse.json({ ok: true, skipped: "알림 시간대 아님" });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return NextResponse.json({ ok: false, error: "텔레그램 설정 없음" }, { status: 500 });
  }

  let text: string;

  if (morning) {
    // 출근: env STATION + env DIRECTION (회사 방향)
    const arr = (await getArrivals()).slice(0, 3);
    text = `🚇 ${process.env.STATION} 출근길 (회사 방향)\n${fmt(arr)}`;
  } else {
    // 퇴근: 퇴근역(없으면 STATION) + 양방향(direction: null)
    // 을지로3가는 2·3호선 환승역이라 subwayId를 비워 두 호선 모두 표시
    const station = process.env.STATION_PM || process.env.STATION;
    const all = await getArrivals({ station, direction: null, subwayId: "" });
    const up = all.filter((a) => a.direction === "상행").slice(0, 2);
    const down = all.filter((a) => a.direction === "하행").slice(0, 2);
    text =
      `🚇 ${station} 퇴근길 (양방향)\n` +
      `▼ 상행\n${fmt(up)}\n\n▼ 하행\n${fmt(down)}`;
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.strin