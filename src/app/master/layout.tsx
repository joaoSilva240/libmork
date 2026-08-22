export default function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900 p-4">
        <h1 className="text-xl font-bold text-white">Libmork — Escudo do Mestre</h1>
      </header>
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
}
