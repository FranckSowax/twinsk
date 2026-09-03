import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import "./globals.css";
import AttributionCapture from "@/components/AttributionCapture";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Twinsk Company — Logistique & Sourcing depuis la Chine",
  description:
    "Fret aérien et maritime, sourcing 1688/Alibaba, échantillonnage, import véhicules et réception délégations. Hong Kong → Monde.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} ${oswald.variable} antialiased`}
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <AttributionCapture />
        {children}
      </body>
    </html>
  );
}
