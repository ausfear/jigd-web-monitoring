import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Template Word dibaca dengan fs saat runtime, jadi harus ikut dibundel ke fungsi server.
  outputFileTracingIncludes: {
    "/api/laporan-keterisian": ["./templates/laporan-keterisian.docx"],
  },
};

export default nextConfig;
