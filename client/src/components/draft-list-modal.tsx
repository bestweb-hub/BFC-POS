import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Edit, Printer, Trash2, ShoppingCart } from "lucide-react";
import type { Order } from "@shared/schema";
import { format } from "date-fns";

interface DraftListModalProps {
  open: boolean;
  onClose: () => void;
  draftOrders: Order[];
  onEditDraft: (orderId: string) => void;
  onPrintDraft: (orderId: string) => void;
  onDeleteDraft: (orderId: string) => void;
}

export function DraftListModal({
  open,
  onClose,
  draftOrders,
  onEditDraft,
  onPrintDraft,
  onDeleteDraft,
}: DraftListModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl" data-testid="modal-draft-list">
        <DialogHeader>
          <DialogTitle>Draft Orders</DialogTitle>
          <DialogDescription>
            Manage your saved draft orders
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-3">
            {draftOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No draft orders</p>
                <p className="text-xs mt-1">Save an order as draft to see it here</p>
              </div>
            ) : (
              draftOrders.map((order) => (
                <Card key={order.id} className="p-4" data-testid={`card-draft-${order.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">Order #{order.orderNumber}</h4>
                        <Badge variant="secondary" data-testid={`badge-status-${order.id}`}>
                          Draft
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Created:</span>{" "}
                          {format(new Date(order.createdAt), "MMM dd, yyyy HH:mm")}
                        </div>
                        {order.tableId && (
                          <div>
                            <span className="font-medium">Table:</span> {order.tableId}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Dining:</span>{" "}
                          {order.diningOption}
                        </div>
                        <div>
                          <span className="font-medium">Total:</span>{" "}
                          <span className="font-mono font-semibold text-foreground">
                            ${parseFloat(order.total).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onEditDraft(order.id)}
                        data-testid={`button-edit-draft-${order.id}`}
                        title="Edit Order"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onPrintDraft(order.id)}
                        data-testid={`button-print-draft-${order.id}`}
                        title="Print Order"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onDeleteDraft(order.id)}
                        data-testid={`button-delete-draft-${order.id}`}
                        title="Delete Order"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
