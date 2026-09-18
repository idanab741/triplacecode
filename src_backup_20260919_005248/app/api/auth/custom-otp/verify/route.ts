import { NextResponse } from "next/server";
import { verifyCustomSignupOtp } from "@/services/auth/customOtpService";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  const code = typeof body?.code === "string" ? body.code : null;
  if (!email || !code) {
    return NextResponse.json({ error: "פרטים חסרים." }, { status: 400 });
  }

  const result = await verifyCustomSignupOtp(email, code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ tokenHash: result.tokenHash });
}
