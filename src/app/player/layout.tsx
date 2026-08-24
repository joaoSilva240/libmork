export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950">
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
}
