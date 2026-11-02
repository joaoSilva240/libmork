import { MasterSidebar } from "@/components/master/MasterSidebar";

export default function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-dominant-deep text-secondary-pure overflow-hidden transition-colors duration-200">
      <MasterSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main data-motion-route className="flex-1 p-3 h-screen flex flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
