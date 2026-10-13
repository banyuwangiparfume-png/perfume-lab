import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    Disiapkan untuk pindah ke VPS sejak awal: `standalone` membuat `next build`
    menghasilkan server.js yang bisa jalan di belakang Nginx/Caddy tanpa
    menulis ulang apa pun.

    Jangan memakai API yang hanya ada di Vercel (@vercel/kv, @vercel/blob,
    Edge Runtime khusus) — semua penyimpanan lewat Supabase.
  */
  output: "standalone",
};

export default nextConfig;
