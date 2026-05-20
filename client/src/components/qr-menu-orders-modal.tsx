import { useState } from "react";
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

interface QROrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: string;
  total: string;
}

interface QROrder extends Order {
  items: QROrderItem[];
}

interface QRMenuOrdersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QRMenuOrdersModal({ open, onOpenChange }: QRMenuOrdersModalProps) {
  const { toast } = useToast();

  const { data: qrOrders = [], isLoading } = useQuery<QROrder[]>({
    queryKey: ["/api/orders/qr"],
    enabled: open,
  });

  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return await apiRequest("PATCH", `/api/orders/${orderId}/accept`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/qr"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Order Accepted",
        description: "The order has been accepted and sent to kitchen",
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
      queryClient.invalidateQueries({ queryKey: ["/api/orders/qr"] });
      toast({
        title: "Order Rejected",
        description: "The order has been rejected",
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

  const handleAcceptOrder = (orderId: string) => {
    acceptOrderMutation.mutate(orderId);
  };

  const handleRejectOrder = (orderId: string) => {
    rejectOrderMutation.mutate(orderId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]" data-testid="dialog-qr-orders">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            QR Menu Orders
          </DialogTitle>
          <DialogDescription>
            Review and manage online orders from customers
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Loading orders...</p>
            </div>
          ) : qrOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <ShoppingCart className="w-12 h-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">No pending QR orders</p>
            </div>
          ) : (
            <div className="space-y-4">
              {qrOrders.map((order) => (
                <Card key={order.id} className="hover-elevate" data-testid={`qr-order-${order.id}`}>
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
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleAcceptOrder(order.id)}
                          disabled={acceptOrderMutation.isPending}
                          data-testid={`button-accept-${order.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectOrder(order.id)}
                          disabled={rejectOrderMutation.isPending}
                          data-testid={`button-reject-${order.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {order.items?.map((item: QROrderItem, index: number) => (
                        <div
                          key={index}
                          className="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
                          data-testid={`order-item-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-mono">
                              {item.quantity}x
                            </Badge>
                            <span className="font-medium">{item.productName}</span>
                          </div>
                          <span className="font-semibold">${item.price}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-muted-foreground">
                        {order.diningOption === "dine-in" ? "Dine In" : order.diningOption === "takeaway" ? "Takeaway" : "Delivery"}
                        {order.tableId && ` • Table ${order.tableId}`}
                      </span>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Amount</p>
                        <p className="text-xl font-bold text-primary" data-testid={`order-total-${order.id}`}>
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
