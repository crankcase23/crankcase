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
                <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
                        <AuthProvider>{children}</AuthProvider>
                </body>
          </html>
        );
}
