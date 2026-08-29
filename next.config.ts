import type { NextConfig } from "next";

const allowedDevOrigins = [
  "100.101.135.45",
  "100.67.193.97",
  "100.83.170.1",
  "localhost",
  "127.0.0.1",
  "*.ts.net",
  "*.local",
  ...(process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((s) => s.trim())
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Reinicie o servidor dev após alterar esta lista para que a origem VPN seja aplicada.
  allowedDevOrigins,
  // Suprime avisos de hydration mismatch causados por extensões do browser
  // que injetam atributos (ex: bis_skin_checked do BitDefender)
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default nextConfig;
