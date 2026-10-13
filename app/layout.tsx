import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/shared/Navbar";
import { SetupNeeded } from "@/components/shared/SetupNeeded";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isConfigured, missingEnv } from "@/lib/env";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Perfumer's Notebook",
  description:
    "Catat formula parfum beserta dilusinya, lihat kekuatan sebenarnya tiap bahan, dan rekam hasil penciuman tiap versi.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Tanpa kredensial Supabase, tiap halaman hanya akan menampilkan error yang
  // tidak menjelaskan apa pun. Lebih baik satu layar yang menyebutkan persis
  // apa yang belum diisi.
  const configured = isConfigured();

  return (
    <html lang="id" className={`${dmSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh antialiased">
        <TooltipProvider delayDuration={200}>
          {configured ? (
            <>
              <Navbar />
              <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
                {children}
              </main>
            </>
          ) : (
            <SetupNeeded missing={missingEnv()} />
          )}
          <Toaster position="top-center" />
        </TooltipProvider>
      </body>
    </html>
  );
}
