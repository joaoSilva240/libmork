import { LogoutButton } from "@/components/auth/LogoutButton";

export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 p-4">
        <h1 className="text-xl font-bold text-white">Libmork — Jogador</h1>
        <LogoutButton />
      </header>
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
}
