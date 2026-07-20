import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_BACKEND_URL || 'http://localhost:8080';

  return {
    plugins: [
      react(),
      svgr({
        svgrOptions: {
          icon: true,
          // This will transform your SVG to a React component
          exportType: "named",
          namedExport: "ReactComponent",
        },
      }),
    ],
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      watch: {
        usePolling: true,
      },
      hmr: {
        host: "localhost",
        port: 3000,
      },
      proxy: {
        '/api': {
          target: target,
          changeOrigin: true,
          secure: false,
        }
      },
    },
    preview: {
      host: "0.0.0.0",
      port: 3000,
      proxy: {
        '/api': {
          target: target,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  };
});
