import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Archivo variabel: sumbu wdth dipakai untuk judul rapat (utility font-cond)
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Web Monitoring JIGD Provinsi Kalimantan Timur",
  description:
    "Web-Based Monitoring App untuk monitoring kelengkapan data geospasial, pencocokan Katalog Unsur Geografi Indonesia (KUGI), dan status publikasi layer pada Portal Jaringan Informasi Geospasial Daerah Kalimantan Timur",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-paper text-ink selection:bg-qty selection:text-sheet">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
