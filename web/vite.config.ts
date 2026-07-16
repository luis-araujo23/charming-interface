// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
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

export default defineConfig({
	vite: {
		envDir: "..",
		plugins: [decodeVirtualIdPlugin()],
	},
});
