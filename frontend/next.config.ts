import type { NextConfig } from "next";

// Бэкенд живёт отдельным процессом на Python. Фронт всегда бьёт в свой
// собственный /api, а Next проксирует запросы дальше: так у браузера нет
// CORS, а адрес шлюза не утекает в клиентский бандл.
const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

// Пустой basePath = сайт живёт в корне домена. Значение вида «/parts»
// позволяет подселить витрину на подпуть чужого домена; оно вшивается в
// сборку, поэтому задаётся build-аргументом, а не переменной рантайма.
const basePath = process.env.BASE_PATH?.replace(/\/$/, "") || "";

const nextConfig: NextConfig = {
  // Самодостаточный сервер вместо копирования node_modules в образ.
  output: "standalone",
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
