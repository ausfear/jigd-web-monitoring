import { InstagramIcon, LinkedinIcon } from "@/components/icons/social-icons";

export function Footer() {
  return (
    <footer className="border-t border-rule bg-sheet py-6">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center justify-between gap-4 px-4 text-sm sm:flex-row sm:px-10">
        <div className="text-center sm:text-left">
          <p className="font-semibold text-ink">Jaringan Informasi Geospasial Daerah (JIGD)</p>
          <p className="text-xs text-ink-2">Pemerintah Provinsi Kalimantan Timur</p>
        </div>

        <div className="flex items-center gap-3 text-ink-2">
          <span>© 2026 Audinta Sakti</span>
          <div className="flex items-center gap-1 border-l border-rule pl-3">
            <a
              href="https://www.instagram.com/ausfear"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @ausfear"
              className="p-1.5 text-ink-2 transition-colors hover:text-ink"
            >
              <InstagramIcon className="h-4 w-4" />
            </a>
            <a
              href="https://www.linkedin.com/in/audinta-sakti/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn Audinta Sakti"
              className="p-1.5 text-ink-2 transition-colors hover:text-ink"
            >
              <LinkedinIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
