/**
 * server/routers/index.ts — Re-exports from the root barrel.
 *
 * esbuild resolves require("../server/routers") to ../server/routers.ts
 * (file wins over directory). This file exists for IDE type resolution only.
 * The actual runtime router is always server/routers.ts.
 */
export { appRouter } from "../routers";
export type { AppRouter } from "../routers";
