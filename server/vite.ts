import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Dynamically import vite only in development to avoid bundling it in production
  // Use Function constructor to prevent esbuild from statically analyzing the import
  const viteLoader = new Function("return import('vite')");
  const viteModule = await viteLoader();
  const { createServer: createViteServer, createLogger } = viteModule;
  const viteLogger = createLogger();

  // Dynamically import vite.config to avoid bundling dev-only plugins
  let viteConfig: any;
  try {
    const baseDir = import.meta.dirname || __dirname;
    const configPath = path.join(baseDir, "..", "vite.config.ts");
    const configLoader = new Function("path", "return import(path)");
    const viteConfigModule = await configLoader(configPath);
    viteConfig =
      typeof viteConfigModule.default === "function"
        ? await viteConfigModule.default()
        : viteConfigModule.default || viteConfigModule;
  } catch (e) {
    // Fallback to basic config if dynamic import fails
    // Use Function constructor to prevent static analysis
    const reactLoader = new Function("return import('@vitejs/plugin-react')");
    const reactModule = await reactLoader();
    viteConfig = { plugins: [reactModule.default()] };
  }

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  // Ensure root is set correctly - resolve from server directory to client
  const baseDir = import.meta.dirname || __dirname;
  const clientRoot = path.resolve(baseDir, "..", "client");
  const projectRoot = path.resolve(baseDir, "..");

  const vite = await createViteServer({
    ...viteConfig,
    root: clientRoot, // Explicitly set root to client directory
    resolve: {
      ...viteConfig.resolve,
      alias: {
        ...viteConfig.resolve?.alias,
        "@": path.resolve(clientRoot, "src"),
        "@shared": path.resolve(projectRoot, "shared"),
        "@assets": path.resolve(projectRoot, "attached_assets"),
      },
    },
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: any, options: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Serve uploads directory in development
  const uploadsPath = path.resolve(baseDir, "..", "uploads");
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsPath));

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Serve uploads directory
  const uploadsPath = path.resolve(__dirname, "..", "uploads");
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsPath));

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
