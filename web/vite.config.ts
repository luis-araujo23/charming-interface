// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, and Nitro on production builds.
// Do NOT add those plugins manually or you will get duplicates.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function stripQuotes(value: string) {
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}

	return value;
}

function loadRootEnvIntoProcessEnv() {
	const envPath = resolve(__dirname, "..", ".env");
	if (!existsSync(envPath)) {
		return;
	}

	const content = readFileSync(envPath, "utf8");
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}

		const separatorIndex = line.indexOf("=");
		if (separatorIndex <= 0) {
			continue;
		}

		const key = line.slice(0, separatorIndex).trim();
		if (!key || process.env[key]) {
			continue;
		}

		const value = stripQuotes(line.slice(separatorIndex + 1).trim());
		process.env[key] = value;
	}
}

loadRootEnvIntoProcessEnv();

function decodeVirtualIdPlugin(): Plugin {
	return {
		name: "decode-virtual-id",
		configureServer(server) {
			server.middlewares.use((req, _res, next) => {
				if (req.url?.includes("/@id/virtual%3A")) {
					req.url = req.url.replace("/@id/virtual%3A", "/@id/virtual:");
				}

				next();
			});
		},
	};
}

// Deploy target: Vercel (Nitro). Do not set cloudflare: false — in Lovable v2
// that disables Nitro entirely. Local `vite build` also uses the vercel preset
// so the artifact matches what Vercel will run.
export default defineConfig({
	nitro: {
		preset: "vercel",
	},
	vite: {
		envDir: "..",
		plugins: [decodeVirtualIdPlugin()],
		server: {
			host: true,
			port: 8080,
		},
	},
});

