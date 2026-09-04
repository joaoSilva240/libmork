import type { Metadata } from "next";
import { Cinzel, Cinzel_Decorative } from "next/font/google";
import { SocketProvider } from "@/context/SocketContext";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import CsrfInit from "@/components/CsrfInit";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

const cinzelDecorative = Cinzel_Decorative({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-cinzel-decorative",
  display: "swap",
});

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
    <html lang="pt-BR" data-theme="default-dark" suppressHydrationWarning className={`${cinzel.variable} ${cinzelDecorative.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
        <SocketProvider>{children}</SocketProvider>
        <ServiceWorkerRegistrar />
        <CsrfInit />
      </body>
    </html>
  );
}
