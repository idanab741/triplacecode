import { NextResponse } from "next/server";
import { sendCustomSignupOtp } from "@/services/auth/customOtpService";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  if (!email) {
    return NextResponse.json({ error: "אימייל חסר." }, { status: 400 });
  }

  const result = await sendCustomSignupOtp(email);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
