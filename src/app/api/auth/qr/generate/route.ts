import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createQrSession } from "@/lib/auth/qr-session";

export async function POST() {
  try {
    const qrSessionId = uuidv4();
    await createQrSession(qrSessionId);

    return NextResponse.json({
      qrSessionId,
      authUrl: `/qr-authorize?token=${qrSessionId}`,
      expiresIn: 120,
    });
  } catch (err) {
    console.error("[QR Generate Error]:", err);
    return NextResponse.json({ error: "Erro ao gerar QR Code" }, { status: 500 });
  }
}
