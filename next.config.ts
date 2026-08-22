import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Suprime avisos de hydration mismatch causados por extensões do browser
  // que injetam atributos (ex: bis_skin_checked do BitDefender)
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default nextConfig;
