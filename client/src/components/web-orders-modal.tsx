import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, Clock, ShoppingCart, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "@shared/schema";

interface WebOrderItem {
  id: string;
  productId: string;
  product?: { id: string; name: string; [key: string]: unknown };
  productName?: string; // legacy; prefer product.name
  quantity: number;
  price: string;
  total: string;
  selectedSize?: string;
}

interface WebOrder extends Order {
  items: WebOrderItem[];
}

interface WebOrdersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WebOrdersModal({ open, onOpenChange }: WebOrdersModalProps) {
  const { toast } = useToast();

  const { data: webOrders = [], isLoading } = useQuery<WebOrder[]>({
    queryKey: ["/api/orders/web"],
    enabled: open,
  });

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
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to accept order",
        variant: "destructive",
      });
    },
  });

  const rejectOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return await apiRequest("PATCH", `/api/orders/${orderId}/reject`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/web"] });
      toast({
        title: "Order Rejected",
        description: "Web order has been rejected",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject order",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]" data-testid="dialog-web-orders">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            Web Orders
          </DialogTitle>
          <DialogDescription>
            Orders placed by customers online. Accept to confirm or reject.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Loading orders...</p>
            </div>
          ) : webOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <ShoppingCart className="w-12 h-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">No pending web orders</p>
            </div>
          ) : (
            <div className="space-y-4">
              {webOrders.map((order) => (
                <Card key={order.id} className="hover-elevate" data-testid={`web-order-${order.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          Order #{order.orderNumber}
                          <Badge variant="secondary" className="font-normal">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(order.createdAt).toLocaleTimeString()}
                          </Badge>
                        </CardTitle>
                        {order.customerName && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {order.customerName}
                            {order.customerPhone && ` • ${order.customerPhone}`}
                            {order.customerContactType && ` • ${order.customerContactType}`}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => acceptOrderMutation.mutate(order.id)}
                          disabled={acceptOrderMutation.isPending}
                          data-testid={`button-accept-web-${order.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectOrderMutation.mutate(order.id)}
                          disabled={rejectOrderMutation.isPending}
                          data-testid={`button-reject-web-${order.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {order.items?.map((item: WebOrderItem, index: number) => (
                        <div
                          key={item.id ?? index}
                          className="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
                          data-testid={`web-order-item-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-mono">
                              {item.quantity}x
                            </Badge>
                            <span className="font-medium">{item.product?.name ?? item.productName ?? "—"}</span>
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
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Web order</span>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Amount</p>
                        <p className="text-xl font-bold text-primary" data-testid={`web-order-total-${order.id}`}>
                          ${order.total}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
