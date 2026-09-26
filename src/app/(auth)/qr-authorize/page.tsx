"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

function QrAuthorizeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          const userData = json.data || json.user;
          if (userData) {
            setUser({
              id: userData.id,
              name: userData.displayName || userData.name || userData.email,
              email: userData.email,
            });
          }
        } else {
          router.push(`/login?redirect=${encodeURIComponent(`/qr-authorize?token=${token}`)}`);
        }
      } catch {
        setStatusMessage("Erro ao verificar autenticação.");
      } finally {
        setIsLoading(false);
      }
    }

    if (token) {
      checkAuth();
    } else {
      setStatusMessage("Token de QR Code ausente ou inválido.");
      setIsLoading(false);
    }
  }, [token, router]);

  const handleAuthorize = async () => {
    if (!token) return;
    setIsAuthorizing(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/auth/qr/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ qrSessionId: token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage(data.error || "Erro ao autorizar login.");
        return;
      }

      setIsSuccess(true);
      setStatusMessage("Login autorizado com sucesso no computador!");
    } catch {
      setStatusMessage("Erro de conexão ao autorizar.");
    } finally {
      setIsAuthorizing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-secondary-border bg-secondary-card p-6 text-center shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-purple-400">Autorização de QR Code</h1>

        {isSuccess ? (
          <div className="my-6 rounded-xl border border-emerald-800/50 bg-emerald-950/40 p-4 text-emerald-300">
            <span className="text-4xl block mb-2">✅</span>
            <p className="font-semibold">{statusMessage}</p>
            <p className="mt-2 text-xs text-gray-400">Você já pode fechar esta aba no seu celular.</p>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-gray-300">
              Você está prestes a autorizar o acesso à sua conta no computador para o usuário:{" "}
              <span className="font-semibold text-white">{user?.name}</span> ({user?.email}).
            </p>

            {statusMessage && (
              <div className="mb-4 rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-xs text-red-300">
                {statusMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handleAuthorize}
              disabled={isAuthorizing}
              className="w-full rounded-xl bg-purple-600 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-purple-500 active:scale-95 disabled:opacity-50"
            >
              {isAuthorizing ? <Spinner size="sm" /> : "Autorizar Login no Computador"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function QrAuthorizePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-950 text-white"><Spinner size="lg" /></div>}>
      <QrAuthorizeContent />
    </Suspense>
  );
}
