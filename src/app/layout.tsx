import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KAVACH — Energy Supply Chain Resilience Command Center",
  description:
    "AI-powered command center for India's energy supply chain resilience. Real-time maritime rerouting, SPR drawdown simulation, and macro-economic shock modeling for crude oil supply disruptions.",
  keywords: [
    "energy security",
    "supply chain",
    "India crude oil",
    "SPR",
    "Strait of Hormuz",
    "maritime routing",
    "AI risk analysis",
  ],
  authors: [{ name: "KAVACH Platform" }],
  openGraph: {
    title: "KAVACH — Energy Supply Chain Resilience Platform",
    description:
      "AI-driven command center for India's energy supply chain resilience",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
