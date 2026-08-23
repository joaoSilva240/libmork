import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 p-4">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-white">Libmork — Escudo do Mestre</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/master" className="text-gray-300 hover:text-white">
              Campanhas
            </Link>
            <Link href="/master/library" className="text-gray-300 hover:text-white">
              Biblioteca
            </Link>
            <Link href="/master/classes" className="text-gray-300 hover:text-white">
              Classes
            </Link>
          </nav>
        </div>
        <LogoutButton />
      </header>
      <main className="mx-auto max-w-[1800px] p-4">{children}</main>
    </div>
  );
}
