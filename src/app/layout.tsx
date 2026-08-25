import type { Metadata } from "next";
import { SocketProvider } from "@/context/SocketContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Libmork — Sistema de RPG de Mesa",
  description: "Aplicativo web de RPG de mesa com sistema de regras próprio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-theme="default-dark" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <SocketProvider>{children}</SocketProvider>
      </body>
    </html>
  );
}
