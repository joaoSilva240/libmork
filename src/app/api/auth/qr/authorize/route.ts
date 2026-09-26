import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getQrSession, authorizeQrSession } from "@/lib/auth/qr-session";

export async function POST(req: NextRequest) {
  try {
    const sessionData = await getSession();
    if (!sessionData) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { user } = sessionData;

    const { qrSessionId } = await req.json();
    if (!qrSessionId) {
      return NextResponse.json({ error: "qrSessionId é obrigatório" }, { status: 400 });
    }

    const qrSession = await getQrSession(qrSessionId);
    if (!qrSession || qrSession.status !== "PENDING") {
      return NextResponse.json({ error: "Sessão QR expirada ou inválida" }, { status: 400 });
    }

    const sessionCookie = req.cookies.get("libmork_session")?.value || "";
    const ok = await authorizeQrSession(qrSessionId, user.id, sessionCookie);

    if (!ok) {
      return NextResponse.json({ error: "Falha ao autorizar sessão QR" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Login autorizado com sucesso",
      user: { id: user.id, name: user.displayName, email: user.email },
      sessionToken: sessionCookie,
    });
  } catch (err) {
    console.error("[QR Authorize Error]:", err);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
