import { NextResponse } from "next/server";
import { kvSet, kvGet } from "../../lib/kv";

export const dynamic = "force-dynamic";
const TG = (t: string, m: string) => `https://api.telegram.org/bot${t}/${m}`;

export async function POST(req: Request) {
  // 보안: 텔레그램 secret token 검증
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  let update: any = null;
  try { update = await req.json(); } catch {}

  const cq = update?.callback_query;
  if (cq?.data && String(cq.data).startsWith("ack:")) {
    // DB에 "확인됨" 기록 (25시간 TTL — 다음날엔 새 키라 자동 만료)
    await kvSet(cq.data, "1", 90000);
    // 스피너 멈춤
    if (token) {
      fetch(TG(token, "answerCallbackQuery"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cq.id, text: "오늘 알림 껐어요 ✅" }),
      }).catch(() => {});
      // 버튼 제거
      const mid = cq.message?.message_id;
      const cid = cq.message?.chat?.id;
      if (mid && cid) {
        fetch(TG(token, "editMessageReplyMarkup"), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: cid, message_id: mid, reply_markup: { inline_keyboard: [] } }),
        }).catch(() => {});
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
  const val = await kvGet(key);
  return NextResponse.json({ ok: true, key, val });
}
