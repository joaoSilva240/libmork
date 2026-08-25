import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-dominant-deep text-secondary-pure">
      <header className="flex items-center justify-between border-b border-dominant-border bg-dominant-dark p-4">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-secondary-pure">Libmork — Escudo do Mestre</h1>
          <nav className="flex gap-4 text-sm font-medium">
            <Link href="/master" className="text-secondary-muted hover:text-accent-vibrant transition-colors">
              Campanhas
            </Link>
            <Link href="/master/library" className="text-secondary-muted hover:text-accent-vibrant transition-colors">
              Biblioteca
            </Link>
            <Link href="/master/classes" className="text-secondary-muted hover:text-accent-vibrant transition-colors">
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
