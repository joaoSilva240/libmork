import type { Metadata } from "next";
import {
  Cinzel,
  Cinzel_Decorative,
  MedievalSharp,
  Almendra,
  Uncial_Antiqua,
  Pirata_One,
  IM_Fell_English_SC,
  Grenze_Gotisch,
  Metamorphous,
  Eagle_Lake,
  Marcellus,
} from "next/font/google";
import QueryProvider from "@/components/providers/QueryProvider";
import { SocketProvider } from "@/context/SocketContext";
import { ThemeProvider } from "@/context/ThemeContext";
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

const medievalSharp = MedievalSharp({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-medievalsharp",
  display: "swap",
});

const almendra = Almendra({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-almendra",
  display: "swap",
});

const uncialAntiqua = Uncial_Antiqua({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-uncial-antiqua",
  display: "swap",
});

const pirataOne = Pirata_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pirata-one",
  display: "swap",
});

const imFellEnglishSC = IM_Fell_English_SC({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-im-fell-english-sc",
  display: "swap",
});

const grenzeGotisch = Grenze_Gotisch({
  weight: ["400", "700", "900"],
  subsets: ["latin"],
  variable: "--font-grenze-gotisch",
  display: "swap",
});

const metamorphous = Metamorphous({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-metamorphous",
  display: "swap",
});

const eagleLake = Eagle_Lake({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-eagle-lake",
  display: "swap",
});

const marcellus = Marcellus({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marcellus",
  display: "swap",
});

const fontVariables = [
  cinzel.variable,
  cinzelDecorative.variable,
  medievalSharp.variable,
  almendra.variable,
  uncialAntiqua.variable,
  pirataOne.variable,
  imFellEnglishSC.variable,
  grenzeGotisch.variable,
  metamorphous.variable,
  eagleLake.variable,
  marcellus.variable,
].join(" ");

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
    <html lang="pt-BR" data-theme="default-dark" suppressHydrationWarning className={fontVariables}>
      <body className="antialiased" suppressHydrationWarning>
        <QueryProvider>
          <ThemeProvider>
            <SocketProvider>{children}</SocketProvider>
          </ThemeProvider>
        </QueryProvider>
        <ServiceWorkerRegistrar />
        <CsrfInit />
      </body>
    </html>
  );
}
