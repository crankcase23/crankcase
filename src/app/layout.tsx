import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: {
    default: "Crankcase Garage — DIY Mechanic Guides",
    template: "%s · Crankcase Garage",
  },
  description:
    "Look up fluid capacities, vehicle specs, torque values, and step-by-step repair guides for your car.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Crankcase Garage",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/*
          This font is loaded with a plain <link> rather than next/font/google
          ON PURPOSE, and the lint rule below is silenced for the same reason.
          next/font/google resolves font names against a metadata list bundled
          with the installed Next.js version -- it does not fetch Google's live
          catalog -- and "Big Shoulders Display" is not in this version's list.
          Using it here does not merely look wrong at runtime, it FAILS THE
          BUILD with "Unknown font" / NextFontGoogleReplacer errors. Three
          deployments died that way on 2026-09-12 before this was tracked down.
          Do not "fix" this warning by switching to next/font without first
          confirming the font name resolves in the installed Next.js version.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
