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
  title: "Moobi Studio",
  description: "Unlock AI-powered creativity with Moobi Studio! Your all-in-one suite for stunning AI video generation, advanced image editing with object removal & enhancement, and seamless audio creation. Generate VFX, CGI elements, and more. Perfect for digital content creators seeking faster, impactful results.",
  openGraph: {
    title: "Moobi Studio - AI Creative Suite for Video, Image & Audio",
    description: "Effortlessly generate & edit AI video, images (including VFX/CGI), and audio with Moobi Studio. Powerful tools for digital content creators.",
    type: "website",
    url: "https://moobilabs.com/",
    images: [
      {
        url: "/moobi-logo.png",
        width: 1024,
        height: 1024,
        alt: "Moobi Studio Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Moobi Studio - AI Creative Suite",
    description: "Generate & edit stunning AI video, images (VFX/CGI), and audio effortlessly with Moobi Studio's creative suite.",
    images: ["/moobi-logo.png"],
  },
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
