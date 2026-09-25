import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo per le anteprime finte aperte dal telefono (HOST_FINTO = indirizzo
  // del Mac nella rete di casa): vale solo in sviluppo, mai su Vercel.
  ...(process.env.HOST_FINTO ? { allowedDevOrigins: [process.env.HOST_FINTO] } : {}),
  env: {
    // Etichetta di versione mostrata nelle legende di Calendario e Arrivi:
    // su Vercel è il commit del deploy, in locale "dev"
    NEXT_PUBLIC_BUILD_TAG: (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7),
  },
};

export default nextConfig;
