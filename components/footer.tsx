import { InstagramIcon, LinkedinIcon } from "@/components/icons/social-icons";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white/80 dark:border-slate-800/80 dark:bg-slate-950/80 backdrop-blur-sm py-6 transition-colors">
      <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        {/* Left: Official Administrative Attribution */}
        <div className="text-slate-500 dark:text-slate-400 text-center sm:text-left">
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            Jaringan Informasi Geospasial Daerah (JIGD)
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Pemerintah Provinsi Kalimantan Timur
          </p>
        </div>

        {/* Right: Copyright & Social Links */}
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            © 2026 Audinta Sakti
          </span>

          <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-800 pl-3">
            <a
              href="https://www.instagram.com/ausfear"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @ausfear"
              className="p-1.5 rounded-lg text-slate-500 hover:text-pink-600 hover:bg-pink-50 dark:text-slate-400 dark:hover:text-pink-400 dark:hover:bg-pink-950/40 transition-colors"
            >
              <InstagramIcon className="h-4 w-4" />
            </a>

            <a
              href="https://www.linkedin.com/in/audinta-sakti/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn Audinta Sakti"
              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-950/40 transition-colors"
            >
              <LinkedinIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
