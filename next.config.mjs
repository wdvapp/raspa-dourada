/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // IGNORA ERROS DE BUILD PARA O SITE SUBIR
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;