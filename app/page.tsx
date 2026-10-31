import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Neatline } from "@/components/lembar-peta";
import { cn } from "@/lib/utils";

/** Indeks halaman, disusun seperti indeks lembar pada tepi peta. */
const SHEETS = [
  {
    href: "/overview",
    title: "Overview",
    body: "Keterisian daftar data tahun berjalan, sebaran tipe geometri, dan sistem koordinat layer.",
  },
  {
    href: "/produsen",
    title: "Produsen data",
    body: "Daftar data, layer terbit, dan persentase keterisian untuk setiap perangkat daerah.",
  },
  {
    href: "/datasets",
    title: "Katalog layer",
    body: "Semua layer di Geoportal JIGD beserta pemilik, geometri, dan SRID-nya.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar currentPage="home" />

      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-10 pt-14 pb-16 sm:pt-20">
        <section className="max-w-[60rem]">
          <h1 className="font-cond text-[40px] font-[750] leading-[1.02] sm:text-[64px]">
            Web Monitoring JIGD Kalimantan Timur
          </h1>
          <p className="mt-5 max-w-[62ch] text-lg text-ink-2">
            Memantau apakah setiap daftar data geospasial perangkat daerah sudah terbit sebagai layer di Geoportal
            JIGD, dan sudah dipetakan ke Katalog Unsur Geografi Indonesia (KUGI).
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/overview"
              className={cn(buttonVariants({ size: "lg" }), "h-11 bg-qty px-5 text-[15px] text-sheet hover:bg-qty/90")}
            >
              Lihat keterisian data
            </Link>
            <a
              href="https://jigd.kaltimprov.go.id/"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 border-ink bg-transparent px-5 text-[15px] text-ink hover:bg-ink/5")}
            >
              Buka Geoportal Kaltim
              <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </section>

        <Neatline className="mt-16 sm:mt-20">
          <nav aria-label="Halaman" className="grid md:grid-cols-3">
            {SHEETS.map((sheet, i) => (
              <Link
                key={sheet.href}
                href={sheet.href}
                className={cn(
                  "group block px-6 py-7 transition-colors hover:bg-qty/5 focus-visible:bg-qty/5 focus-visible:outline-none",
                  i > 0 && "border-t border-rule md:border-t-0 md:border-l"
                )}
              >
                <span className="text-sm tabular-nums text-contour">Lembar {i + 1}</span>
                <h2 className="mt-1 font-cond text-[26px] font-bold leading-tight group-hover:text-qty">{sheet.title}</h2>
                <p className="mt-2 text-[15px] text-ink-2">{sheet.body}</p>
              </Link>
            ))}
          </nav>
        </Neatline>

        <section className="mt-16 grid gap-6 border-t border-rule pt-8 md:grid-cols-[1fr_2fr]">
          <h2 className="font-cond text-[21px] font-bold">Dasar penyelenggaraan</h2>
          <div className="max-w-[68ch] space-y-3 text-[15px] text-ink-2">
            <p>
              Simpul jaringan daerah diselenggarakan berdasarkan Peraturan Presiden No. 27 Tahun 2014 tentang Jaringan
              Informasi Geospasial Nasional dan Peraturan Presiden No. 39 Tahun 2019 tentang Satu Data Indonesia.
            </p>
            <p>
              Petugas verifikasi dapat{" "}
              <Link href="/login" className="text-link underline-offset-2 hover:underline">masuk</Link>{" "}
              untuk mencocokkan daftar data dengan layer dan unsur KUGI.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
