import { NextResponse } from "next/server";
import { getArrivals, Arrival } from "../../lib/metro";
import { getWeather, fmtWeather } from "../../lib/weather";
import { kvGet, kvPush } from "../../lib/kv";

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

// 열차 위치 정보 제거, 도착 시점만
function cleanMsg(message: string): string {
  const m = message.replace(/\s*\([^)]*\)/g, "").trim();
  if (/분|초/.test(m)) return m;
  if (/도착|진입|출발/.test(m)) return "곧 도착";
  return m;
}

// 퇴근길 고정 순서: 2호선← , 2호선→ , 3호선↑ , 3호선↓ , 4호선↑ , 4호선↓
function orderOf(line: string, arrow: string): number {
  const order: Record<string, number> = {
    "2호선←": 0, "2호선→": 1,
    "3호선↑": 2, "3호선↓": 3,
    "4호선↑": 4, "4호선↓": 5,
  };
  return order[line + arrow] ?? 9;
}

function fmt(arr: Arrival[]) {
  return arr.length
    ? arr.map((a, i) => `${i + 1}. ${cleanMsg(a.message)}${a.express ? " ⚡급행" : ""}`).join("\n")
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

  // 0) DB에서 오늘 이 모드의 "확인" 여부 확인 (웹훅이 기록) → 눌렸으면 발송 안 함
  if ((await kvGet(ackData)) === "1") {
    return NextResponse.json({ ok: true, skipped: "확인됨 — 재발송 중단" });
  }

  let text: string;

  try {
    if (morning) {
      // 출근: env STATION + env DIRECTION (신당 → 회사 방향)
      const arr = (await getArrivals().catch(() => getArrivals())).slice(0, 3);
      text = `🚇 ${process.env.STATION} 출근길 (회사 방향)\n${fmt(arr)}`;
    } else {
      // 퇴근: 을지로3가(2·3호선) + 명동(4호선), 역·호선·방향별 그룹
      const pmStation = process.env.STATION_PM || process.env.STATION || "";
      const stations = [pmStation, "명동"];
      const lists = await Promise.all(
        stations.map((s) => getArrivals({ station: s, direction: null, subwayId: "" }).catch(() => []))
      );
      const groups = new Map<string, { head: string; line: string; arrow: string; arr: Arrival[] }>();
      stations.forEach((st, i) => {
        for (const a of lists[i]) {
          const arrow = arrowOf(a.line, a.direction, a.heading);
          const key = `${st}|${a.line}|${arrow}`;
          const g = groups.get(key) ?? {
            head: `${arrow} ${a.line} ${a.heading || a.direction}`.trim(),
            line: a.line, arrow, arr: [],
          };
          if (g.arr.length < 3) g.arr.push(a);
          groups.set(key, g);
        }
      });
      const body = [...groups.values()]
        .sort((x, y) => orderOf(x.line, x.arrow) - orderOf(y.line, y.arrow))
        .map((g) => `${g.head}\n${fmt(g.arr)}`)
        .join("\n\n");
      text = `🚇 퇴근길\n${body || "도착 정보 없음"}`;
    }
  } catch (e: any) {
    text = `⚠️ 지하철 정보 조회 실패: ${e.message}`;
  }

  // 오늘 날씨 한 줄 (최저/최고·강수확률) — 실패해도 무시
  const w = fmtWeather(await getWeather().catch(() => null));
  if (w) text = `${w}\n\n${text}`;

  // 발송 직전 DB 재확인 — 메시지 만드는 사이(수 초)에 확인 누른 경우 트레일링 메시지 차단
  if ((await kvGet(ackData)) === "1") {
    return NextResponse.json({ ok: true, skipped: "발송 직전 확인됨 — 중단" });
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

  // 보낸 메시지 id 누적 — 확인 누르면 웹훅이 이 목록 전체의 버튼을 제거
  const mid = tgRes.result?.message_id;
  if (mid) await kvPush(`msgs:${mode}:${date}`, String(mid), 50000);

  return NextResponse.json({ ok: true, mode });
}
