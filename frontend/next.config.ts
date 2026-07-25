import type { NextConfig } from "next";

// Бэкенд живёт отдельным процессом на Python. Фронт всегда бьёт в свой
// собственный /api, а Next проксирует запросы дальше: так у браузера нет
// CORS, а адрес шлюза не утекает в клиентский бандл.
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
