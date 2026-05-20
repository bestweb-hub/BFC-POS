import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, User, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "@shared/schema";

interface OrderItem {
  id: string;
  productId: string;
  product?: { id: string; name: string; [key: string]: unknown };
  productName?: string;
  quantity: number;
  price: string;
  total: string;
  selectedSize?: string;
}

interface NewWebOrderAlertProps {
  order: (Order & { items?: OrderItem[] }) | null;
  open: boolean;
  onClose: () => void;
}

export function NewWebOrderAlert({ order, open, onClose }: NewWebOrderAlertProps) {
  const { toast } = useToast();

  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return await apiRequest("PATCH", `/api/orders/${orderId}/accept`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/web"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Order Accepted",
        description: "Web order has been accepted",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to accept order",
        variant: "destructive",
      });
    },
  });

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary animate-bounce" />
            New Web Order!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Order Number</span>
            <Badge variant="secondary" className="font-mono">
              #{order.orderNumber}
            </Badge>
          </div>

          {order.customerName && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{order.customerName}</span>
              </div>
              {order.customerPhone && (
                <p className="text-sm text-muted-foreground pl-6">{order.customerPhone}</p>
              )}
              {order.customerContactType && (
                <p className="text-xs text-muted-foreground pl-6 capitalize">
                  Contact via: {order.customerContactType}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            {new Date(order.createdAt).toLocaleString()}
          </div>

          {order.items && order.items.length > 0 && (
            <div className="border rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
              <p className="text-sm font-medium mb-2">Order Items:</p>
              {order.items.map((item, idx) => (
                <div
                  key={item.id ?? idx}
                  className="flex justify-between items-center py-1 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {item.quantity}x
                    </Badge>
                    <span>{item.product?.name ?? item.productName ?? "—"}</span>
                    {item.selectedSize && (
                      <Badge variant="secondary" className="text-xs">
                        {item.selectedSize}
                      </Badge>
                    )}
                  </div>
                  <span className="font-semibold">${item.price}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">${order.total}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Later
          </Button>
          <Button
            onClick={() => acceptOrderMutation.mutate(order.id)}
            disabled={acceptOrderMutation.isPending}
            className="gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {acceptOrderMutation.isPending ? "Accepting..." : "Accept Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
