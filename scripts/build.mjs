import { spawnSync } from "node:child_process";

// Hostinger's Linux image needs SWC WASM; Turbopack requires native SWC.
const portable = process.env.COFI_HOSTINGER_BUILD === "1";
const args = ["node_modules/next/dist/bin/next", "build"];
if (portable) args.push("--webpack");
const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
