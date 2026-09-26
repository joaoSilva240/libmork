import { NextRequest, NextResponse } from "next/server";
import { getQrSession, consumeQrSession } from "@/lib/auth/qr-session";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token é obrigatório" }, { status: 400 });
  }

  const qrSession = await getQrSession(token);
  if (!qrSession) {
    return NextResponse.json({ status: "EXPIRED" });
  }

  if (qrSession.status === "AUTHENTICATED") {
    await consumeQrSession(token);
    const response = NextResponse.json({
      status: "AUTHENTICATED",
      userId: qrSession.userId,
      sessionToken: qrSession.sessionToken,
    });

    if (qrSession.sessionToken) {
      response.cookies.set({
        name: "libmork_session",
        value: qrSession.sessionToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }

    return response;
  }

  return NextResponse.json({ status: qrSession.status });
}
