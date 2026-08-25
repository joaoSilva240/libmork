export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-dominant-deep text-secondary-pure">
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
}
