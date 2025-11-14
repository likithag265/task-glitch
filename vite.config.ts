import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// No Node imports. Works on Vercel / Netlify
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
