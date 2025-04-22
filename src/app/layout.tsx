import type { Metadata } from "next";
import { Playfair_Display, Manrope } from "next/font/google";
import "./globals.css";
import SupabaseListener from "@/components/SupabaseListener";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import MainLayout from "@/components/MainLayout";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ['400', '700'],
  variable: '--font-playfair',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ['300', '400', '500', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "AI Creative Suite",
  description: "AI-powered creative tools for video, image, and audio generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Font links managed by next/font, no <link> tags needed here */}
      </head>
      <body
        className={cn(
          "antialiased",
          playfair.variable,
          manrope.variable
        )}
      >
        <SupabaseListener />
        <MainLayout>{children}</MainLayout>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
