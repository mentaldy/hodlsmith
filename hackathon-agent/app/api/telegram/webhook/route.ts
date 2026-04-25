import { NextRequest, NextResponse } from "next/server";
import { handleUpdate } from "@/lib/bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    await handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram.webhook]", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ alive: true, service: "bag-check-telegram-webhook" });
}
