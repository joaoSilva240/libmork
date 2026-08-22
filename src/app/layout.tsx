import type { Metadata } from "next";
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
    <html lang="pt-BR">
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
