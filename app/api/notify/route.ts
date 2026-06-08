import { NextResponse } from "next/server";
import { getArrivals, Arrival } from "../../lib/metro";

export const dynamic = "force-dynamic";

// 한국시간 기준 현재 상태 판단
function nowKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return {
    day: kst.getUTCDay(),                  // 0=일~6=토
    hour: kst.getUTCHours(),
    date: kst.toISOString().slice(0, 10),  // yyyy-mm-dd (KST)
  };
}

function fmt(arr: Arrival[]) {
  return arr.length
    ? arr.map((a, i) => `${i + 1}. ${a.message}${a.express ? " ⚡급행" : ""} → ${a.dest}행`).join("\n")
    : "도착 정보 없음";
}

// 방향 화살표: 2호선(을지로3가 기준) 을지로4가방면 → / 을지로입구방면 ←, 그 외 상행 ↑ / 하행 ↓
function arrowOf(line: string, direction: string, heading: string): string {
  if (line === "2호선") {
    if (heading.includes("을지로4가")) return "→";
    if (heading.includes("을지로입구")) return "←";
    return direction === "내선" ? "→" : "←";
  }
  if (direction === "상행") return "↑";
  if (direction === "하행") return "↓";
  return "";
}

const TG = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { day, hour, date } = nowKST();
  const weekday = day >= 1 && day <= 5;
  if (!weekday) return NextResponse.json({ ok: true, skipped: "주말" });

  const morning = hour >= 7 && hour <= 9;   // 출근 시간대
  const evening = hour >= 17 && hour <= 20; // 퇴근 시간대
  if (!morning && !evening) return NextResponse.json({ ok: true, skipped: "알림 시간대 아님" });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return NextResponse.json({ ok: false, error: "텔레그램 설정 없음" }, { status: 500 });
  }

  const mode = morning ? "출근" : "퇴근";
  const ackData = `ack:${mode}:${date}`; // 확인 버튼 식별자 (모드+날짜)

  // 0) 오늘 이 모드의 "확인" 버튼이 이미 눌렸으면 발송 안 함 (2분 반복 중단)
  try {
    const up = await fetch(
      TG(token, "getUpdates") + '?allowed_updates=%5B%22callback_query%22%5D',
      { cache: "no-store" }
    ).then((r) => r.json());
    const hit = (up.result ?? []).find((u: any) => u.callback_query?.data === ackData);
    if (hit) {
      // 눌린 메시지의 버튼 제거 (실패해도 무시)
      const mid = hit.callback_query.message?.message_id;
      if (mid) {
        fetch(TG(token, "editMessageReplyMarkup"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: mid, reply_markup: { inline_keyboard: [] } }),
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true, skipped: "확인됨 — 재발송 중단" });
    }
  } catch {
    // ack 확인 실패 시에는 그냥 발송 (안전한 쪽으로)
  }

  let text: string;

  try {
    if (morning) {
      // 출근: env STATION + env DIRECTION (신당 → 회사 방향)
      const arr = (await getArrivals()).slice(0, 3);
      text = `🚇 ${process.env.STATION} 출근길 (회사 방향)\n${fmt(arr)}`;
    } else {
      // 퇴근: 을지로3가(2·3호선) + 명동(4호선), 역·호선·방향별 그룹
      const pmStation = process.env.STATION_PM || process.env.STATION || "";
      const stations = [pmStation, "명동"];
      const lists = await Promise.all(
        stations.map((s) => getArrivals({ station: s, direction: null, subwayId: "" }))
      );
      const groups = new Map<string, { head: string; arr: Arrival[] }>();
      stations.forEach((st, i) => {
        for (const a of lists[i]) {
          const key = `${st} ${a.line} ${a.heading || a.direction} ${arrowOf(a.line, a.direction, a.heading)}`.trim();
          const g = groups.get(key) ?? { head: key, arr: [] };
          if (g.arr.length < 2) g.arr.push(a);
          groups.set(key, g);
        }
      });
      const body = [...groups.entries()]
        .map(([k, g]) => `▼ ${k}\n${fmt(g.arr)}`)
        .join("\n\n");
      text = `🚇 퇴근길\n${body || "도착 정보 없음"}`;
    }
  } catch (e: any) {
    text = `⚠️ 지하철 정보 조회 실패: ${e.message}`;
  }

  // 발송 (확인 버튼 포함 — 누르면 2분 반복 중단)
  const tg = await fetch(TG(token, "sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: [[{ text: "✅ 확인 (오늘 알림 끄기)", callback_data: ackData }]] },
    }),
  });
  const tgRes = await tg.json().catch(() => null);
  if (!tgRes || !tgRes.ok) {
    return NextResponse.json({ ok: false, error: "텔레그램 전송 실패", detail: tgRes }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode });
}
