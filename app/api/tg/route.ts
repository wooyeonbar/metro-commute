import { NextResponse } from "next/server";
import { kvSet, kvGet, kvList } from "../../lib/kv";

export const dynamic = "force-dynamic";
const TG = (t: string, m: string) => `https://api.telegram.org/bot${t}/${m}`;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  let update: any = null;
  try { update = await req.json(); } catch {}

  const cq = update?.callback_query;
  if (cq?.data && String(cq.data).startsWith("ack:")) {
    const data = String(cq.data);                 // ack:<mode>:<date>
    const [, mode, date] = data.split(":");
    await kvSet(data, "1", 90000);                 // 확인 기록 (25h)

    const cid = cq.message?.chat?.id;
    if (token) {
      // 누른 콜백 응답 (스피너 멈춤)
      fetch(TG(token, "answerCallbackQuery"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cq.id, text: "오늘 알림 껐어요 ✅" }),
      }).catch(() => {});

      // 그날 이 모드로 보낸 '모든' 알림 메시지의 버튼 제거
      const ids = await kvList(`msgs:${mode}:${date}`);
      const tappedId = cq.message?.message_id;
      const allIds = new Set<string>([...ids, ...(tappedId ? [String(tappedId)] : [])]);
      if (cid) {
        for (const id of allIds) {
          fetch(TG(token, "editMessageReplyMarkup"), {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: cid, message_id: Number(id), reply_markup: { inline_keyboard: [] } }),
          }).catch(() => {});
        }
        // 누른 메시지엔 확인 표시 한 줄 덧붙임
        if (tappedId && cq.message?.text) {
          fetch(TG(token, "editMessageText"), {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: cid, message_id: tappedId, text: `${cq.message.text}\n\n✅ 확인됨 — 오늘 ${mode} 알림 종료` }),
          }).catch(() => {});
        }
      }
    }
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const key = u.searchParams.get("key") || "";
  return NextResponse.json({ ok: true, key, val: await kvGet(key), list: await kvList(key) });
}
