import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

/** Single store: connect with no branch filter; receive all web-order-created events. */
export function useWebOrderSocket(onNewOrder?: (order: any) => void) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?branchId=`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "web-order-created") {
          queryClient.invalidateQueries({ queryKey: ["/api/orders/web"] });
          queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          if (onNewOrder && data.order) {
            onNewOrder(data.order);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [onNewOrder]);
}
