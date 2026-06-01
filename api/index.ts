import path from "path";
import { createServer } from "http";

// Dynamically import the pre-built server bundle
let handler: any;

async function getApp() {
  if (!handler) {
    // The build outputs dist/index.js which is the full Express server
    const serverModule = await import(path.resolve(process.cwd(), "dist/index.js"));
    handler = serverModule.default || serverModule;
  }
  return handler;
}

export default async function(req: any, res: any) {
  const app = await getApp();
  app(req, res);
}