export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-dominant-deep text-secondary-pure">
      <main className="container mx-auto px-4 pt-4 pb-0 min-h-[100dvh]">{children}</main>
    </div>
  );
}
