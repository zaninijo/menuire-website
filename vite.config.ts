import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import route from "./routes.json" with { type: "json" };
import { viteStaticCopy } from "vite-plugin-static-copy";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Gera dinamicamente o input do rollup a partir do JSON
const input: Record<string, string> = {};
for (const [key, path] of Object.entries(route)) {
    let normalizedPath;

    if (path === '/' || path === '') {
        normalizedPath = 'index.html';
    } else {
        normalizedPath = path.replace(/^\//, '') + '.html';
    }

    input[key] = resolve(__dirname, normalizedPath);
}

export default defineConfig({
    base: "/",
    server: {
        port: 5000,
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: "routes.base.json",
                    dest: ".",
                    rename: "routes.json"
                },
                {
                    src: "assets/menu_layout/**/*",
                    dest: "assets/menu_layout/",
                }
            ]
        })
    ],
    build: {
        // Essas configurações levantam um aviso de segurança do npm, mas eu achei melhor manter-las por conveniencia.
        outDir: "../menuire-server/public",
        emptyOutDir: true,
        minify: "esbuild",
        sourcemap: false,
        rollupOptions: {
            input,
        },
    },
});
