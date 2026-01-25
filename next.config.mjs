/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ignora erros de TypeScript
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ignora erros de Lint
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;