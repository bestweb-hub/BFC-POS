import { WebSocketServer } from "ws";
import type { Server } from "http";

const WS_PATH = "/ws";

export function createWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: WS_PATH });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const branchId = url.searchParams.get("branchId") || "";
    (ws as any).branchId = branchId;
  });

  return wss;
}

export function emitWebOrderCreated(wss: WebSocketServer, branchId: string | null, order: unknown): void {
  const payload = JSON.stringify({ event: "web-order-created", branchId: branchId ?? null, order });
  wss.clients.forEach((client) => {
    const clientBranch = (client as any).branchId ?? "";
    const match = !branchId || branchId === "" || clientBranch === branchId;
    if (match && client.readyState === 1) {
      client.send(payload);
    }
  });
}
