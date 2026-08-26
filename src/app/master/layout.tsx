import { MasterSidebar } from "@/components/master/MasterSidebar";

export default function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <MasterSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 p-3 h-screen flex flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
