import Link from "next/link";
import { InviteClient } from "@/components/invites/InviteClient";
import { getPublicInvite } from "@/lib/server/public-invite";

type InvitePageProps = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const normalizedToken = token?.trim() ?? "";

  if (!normalizedToken) {
    return <UnavailableInvite message="O link não contém um token de convite válido." />;
  }

  let result: Awaited<ReturnType<typeof getPublicInvite>> | null = null;
  let lookupError = false;
  try {
    result = await getPublicInvite(normalizedToken);
  } catch {
    lookupError = true;
  }

  if (lookupError || !result) {
    return <UnavailableInvite message="Não foi possível consultar o convite. Tente novamente mais tarde." />;
  }
  if (!result.invite) {
    return (
      <UnavailableInvite
        message={result.error === "campaign-not-found" ? "A campanha deste convite não foi encontrada." : "O convite é inválido ou foi revogado pelo mestre."}
      />
    );
  }
  return <InviteClient invite={result.invite} token={normalizedToken} />;
}

function UnavailableInvite({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-lg border border-red-800 bg-red-900/30 p-6 text-center">
        <h1 className="mb-2 text-2xl font-bold text-white">Convite indisponível</h1>
        <p className="text-red-300">{message}</p>
        <Link href="/login" className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">Ir para o login</Link>
      </div>
    </div>
  );
}
