import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer, Receipt, Utensils, Calendar, Hash, FileText } from "lucide-react";
import type { Order, OrderItem, Product, Settings } from "@shared/schema";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ReceiptTemplate } from "@/lib/receipt-templates";
import { generateReceiptHTML } from "@/lib/receipt-templates";
import { useToast } from "@/hooks/use-toast";

interface ReceiptPrintModalProps {
  open: boolean;
  onClose: () => void;
  order: {
    orderNumber: string;
    items: Array<{
      product: Product;
      quantity: number;
      price: string;
      total: string;
      itemDiscount?: number;
      itemDiscountType?: 'amount' | 'percentage';
      selectedSize?: string;
    }>;
    originalSubtotal?: number;
    itemDiscounts?: number;
    subtotal: number;
    discount: number;
    discountType?: 'amount' | 'percentage';
    discountRaw?: number;
    totalDiscount?: number;
    total: number;
    subscriptionDiscount?: number;
    tableId?: string | null;
    diningOption: string;
    paymentMethod?: string;
    paymentSplits?: string;
    changeDue?: number;
  };
  onPrint: () => void;
}

function formatDualCurrency(usdAmount: number, settings?: Settings) {
  const exchangeRate = settings?.exchangeRate ? parseFloat(settings.exchangeRate) : 4100;
  const secondaryCurrencySymbol = settings?.secondaryCurrencySymbol || "៛";
  const showSecondaryCurrency = settings?.secondaryCurrency && settings?.exchangeRate;
  
  const secondaryAmount = usdAmount * exchangeRate;
  return {
    usd: `$${usdAmount.toFixed(2)}`,
    secondary: showSecondaryCurrency 
      ? `${secondaryAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${secondaryCurrencySymbol}`
      : null
  };
}

export function ReceiptPrintModal({
  open,
  onClose,
  order,
  onPrint,
}: ReceiptPrintModalProps) {
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    enabled: open,
  });
  const { toast } = useToast();

  const [selectedTemplate, setSelectedTemplate] = useState<ReceiptTemplate>("classic");

  const handlePrint = async () => {
    try {
      // Calculate total in KHR
      const totalUSD = order.total;
      const totalKHRNum = totalUSD * 4100;
      const totalKHR = totalKHRNum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

      const methodLabels: Record<string, string> = {
        cash: "Cash",
        card: "Card",
        aba: "ABA",
        acleda: "Acleda",
        due: "Due",
        cash_aba: "Cash And ABA",
        cash_acleda: "Cash And Acleda",
      };

      // Parse payment splits if available; otherwise use single paymentMethod
      let paymentDetails: string;
      if (order.paymentSplits) {
        paymentDetails = `<p><strong>Pay by:</strong> Split Payment</p>`;
        try {
          const splits: { method: string; amount: number }[] = JSON.parse(order.paymentSplits);
          if (splits.length > 0) {
            const splitsHtml = splits.map(split => {
              const methodLabel = methodLabels[split.method] || split.method;
              const amountKHR = (split.amount * 4100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              return `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span>${methodLabel}:</span>
                  <span><strong>$${split.amount.toFixed(2)}</strong> (៛${amountKHR})</span>
                </div>
              `;
            }).join('');
            paymentDetails = `
              <div style="margin-top: 10px;">
                <p style="margin-bottom: 10px;"><strong>Payment Split:</strong></p>
                <div style="border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px; background-color: #f9fafb;">
                  ${splitsHtml}
                </div>
              </div>
            `;
          }
        } catch (error) {
          console.error("Failed to parse payment splits:", error);
        }
      } else {
        const singleMethodLabel = order.paymentMethod
          ? (methodLabels[order.paymentMethod.toLowerCase()] || order.paymentMethod)
          : "Cash";
        paymentDetails = `<p><strong>Pay by:</strong> ${singleMethodLabel}</p>`;
      }

      // Create a mock Order object for the template generator
      const totalDiscount = order.totalDiscount !== undefined ? order.totalDiscount : order.discount;
      const isPct = order.discountType === 'percentage' && order.discountRaw != null;
      const mockOrder: Order = {
        id: `temp-${Date.now()}`,
        orderNumber: order.orderNumber,
        tableId: order.tableId || null,
        customerId: null,
        branchId: null,
        diningOption: order.diningOption,
        customerName: null,
        customerPhone: null,
        customerContactType: null,
        orderSource: "pos",
        subtotal: order.originalSubtotal !== undefined ? order.originalSubtotal.toString() : order.subtotal.toString(),
        discount: isPct ? String(order.discountRaw) : totalDiscount.toString(),
        discountType: isPct ? "percentage" : "amount",
        total: order.total.toString(),
        dueAmount: null,
        paidAmount: order.total.toString(),
        status: "completed",
        paymentStatus: "paid",
        paymentMethod: order.paymentSplits ? "split" : (order.paymentMethod || "cash"),
        paymentSplits: order.paymentSplits || null,
        subscriptionCardId: null,
        subscriptionDiscount: (order.subscriptionDiscount ?? 0).toFixed(2),
        createdAt: new Date(),
        completedAt: new Date(),
      };

      // Generate receipt HTML using template
      // Ensure all items are included in the receipt
      const receiptItems = order.items.map((item, index) => ({
        id: `temp-${Date.now()}-${index}`,
        orderId: mockOrder.id,
        productId: item.product.id,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        productName: item.product.name + (item.selectedSize ? ` (${item.selectedSize})` : ''),
        selectedSize: item.selectedSize,
      }));

      const receiptData = {
        sale: mockOrder,
        items: receiptItems,
        settings,
        totalKHR: totalKHRNum,
        paymentDetails,
      };

      const content = generateReceiptHTML(selectedTemplate, receiptData);

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Error",
          description: "Please allow popups to print receipts",
          variant: "destructive",
        });
        return;
      }

      printWindow.document.write(content);
      printWindow.document.close();
      
      // Wait for content to load before printing
      setTimeout(() => {
        printWindow.print();
      }, 250);

      onPrint();
    } catch (error) {
      console.error("Error printing receipt:", error);
      toast({
        title: "Error",
        description: "Failed to print receipt",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col" data-testid="modal-receipt-print">
        <DialogHeader className="space-y-3 pb-2 flex-shrink-0">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Receipt className="w-5 h-5 text-primary-foreground" />
            </div>
            <DialogTitle className="text-xl">Receipt Preview</DialogTitle>
          </div>
        </DialogHeader>

        {/* Template Selection */}
        <div className="space-y-2 px-2 flex-shrink-0">
          <Label htmlFor="receipt-template">Receipt Template</Label>
          <Select
            value={selectedTemplate}
            onValueChange={(value: ReceiptTemplate) => setSelectedTemplate(value)}
          >
            <SelectTrigger id="receipt-template" data-testid="select-receipt-template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="classic">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Classic</span>
                </div>
              </SelectItem>
              <SelectItem value="modern">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Modern</span>
                </div>
              </SelectItem>
              <SelectItem value="compact">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Compact</span>
                </div>
              </SelectItem>
              <SelectItem value="detailed">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Detailed</span>
                </div>
              </SelectItem>
              <SelectItem value="elegant">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Elegant</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select a template style for your receipt
          </p>
        </div>

        <Separator className="flex-shrink-0" />

        <ScrollArea className="flex-1 min-h-0 overflow-hidden">
          <div className="space-y-4 py-4 pr-4" id="receipt-content">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg -z-10" />
              <div className="text-center space-y-2 py-6 px-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <Utensils className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    BondPos
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground font-medium">Point of Sale System</p>
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{format(new Date(), "MMM dd, yyyy HH:mm")}</span>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-b-2 border-dashed border-border py-3 space-y-2">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Order #:</span>
                </div>
                <Badge variant="secondary" className="font-mono font-semibold">
                  {order.orderNumber}
                </Badge>
              </div>
              {order.tableId && (
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm text-muted-foreground">Table:</span>
                  <Badge variant="outline" className="font-semibold">
                    {order.tableId}
                  </Badge>
                </div>
              )}
              <div className="flex items-center justify-between px-2">
                <span className="text-sm text-muted-foreground">Dining Option:</span>
                <Badge className="capitalize bg-primary/10 text-primary hover:bg-primary/20">
                  {order.diningOption}
                </Badge>
              </div>
            </div>

            <div className="space-y-3 px-2">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Order Items ({order.items.length})
                </h3>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              </div>
              <div className="max-h-[40vh] min-h-[200px] overflow-y-auto">
                <div className="space-y-3 pr-2">
                  {order.items.map((item, index) => {
                    const itemPrice = parseFloat(item.price);
                    const itemSubtotal = itemPrice * item.quantity;
                    const itemTotal = parseFloat(item.total);
                    const hasItemDiscount = item.itemDiscount !== undefined && item.itemDiscount > 0;
                    const itemDiscountAmount = hasItemDiscount
                      ? (item.itemDiscountType === 'percentage'
                          ? (itemSubtotal * item.itemDiscount) / 100
                          : item.itemDiscount)
                      : 0;
                    
                    const priceFormatted = formatDualCurrency(itemPrice, settings);
                    const subtotalFormatted = formatDualCurrency(itemSubtotal, settings);
                    const totalFormatted = formatDualCurrency(itemTotal, settings);
                    
                    return (
                      <div 
                        key={`${item.product.id}-${index}`} 
                        className="bg-accent/30 rounded-lg p-3 hover-elevate transition-all" 
                        data-testid={`receipt-item-${index}`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm break-words">{item.product.name}</p>
                              {item.selectedSize && (
                                <Badge variant="secondary" className="text-xs">
                                  {item.selectedSize}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs font-mono">
                                {item.quantity}x
                              </Badge>
                              {priceFormatted.secondary && (
                                <span className="text-xs text-muted-foreground">
                                  {priceFormatted.usd} / {priceFormatted.secondary}
                                </span>
                              )}
                              {!priceFormatted.secondary && (
                                <span className="text-xs text-muted-foreground">
                                  {priceFormatted.usd}
                                </span>
                              )}
                            </div>
                            {hasItemDiscount && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {item.itemDiscountType === 'percentage' ? `${item.itemDiscount}%` : `$${item.itemDiscount.toFixed(2)}`} discount: -{formatDualCurrency(itemDiscountAmount, settings).usd}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            {hasItemDiscount && (
                              <p className="font-mono text-xs text-muted-foreground line-through mb-1">
                                {subtotalFormatted.usd}
                              </p>
                            )}
                            <p className="font-mono font-bold text-primary text-sm">
                              {totalFormatted.usd}
                            </p>
                            {totalFormatted.secondary && (
                              <p className="font-mono text-xs text-muted-foreground">
                                {totalFormatted.secondary}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          <Separator className="my-4" />

          <div className="space-y-2 px-2">
            {order.originalSubtotal !== undefined && order.originalSubtotal !== order.subtotal && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <div className="text-right">
                  <p className="font-mono font-medium line-through text-muted-foreground">{formatDualCurrency(order.originalSubtotal, settings).usd}</p>
                  {formatDualCurrency(order.originalSubtotal, settings).secondary && (
                    <p className="font-mono text-xs text-muted-foreground line-through">{formatDualCurrency(order.originalSubtotal, settings).secondary}</p>
                  )}
                </div>
              </div>
            )}
            {order.itemDiscounts !== undefined && order.itemDiscounts > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Item Discounts:</span>
                <div className="text-right">
                  <p className="font-mono font-medium text-accent">
                    -{formatDualCurrency(order.itemDiscounts, settings).usd}
                  </p>
                  {formatDualCurrency(order.itemDiscounts, settings).secondary && (
                    <p className="font-mono text-xs text-muted-foreground">-{formatDualCurrency(order.itemDiscounts, settings).secondary}</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <div className="text-right">
                <p className="font-mono font-medium">{formatDualCurrency(order.subtotal, settings).usd}</p>
                {formatDualCurrency(order.subtotal, settings).secondary && (
                  <p className="font-mono text-xs text-muted-foreground">{formatDualCurrency(order.subtotal, settings).secondary}</p>
                )}
              </div>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Global Discount{order.discountType === 'percentage' && order.discountRaw != null ? ` (${order.discountRaw}%)` : ' ($)'}:
                </span>
                <div className="text-right">
                  <p className="font-mono font-medium text-accent">
                    -{formatDualCurrency(order.discount, settings).usd}
                  </p>
                  {formatDualCurrency(order.discount, settings).secondary && (
                    <p className="font-mono text-xs text-muted-foreground">-{formatDualCurrency(order.discount, settings).secondary}</p>
                  )}
                </div>
              </div>
            )}
            {order.totalDiscount !== undefined && order.totalDiscount > 0 && (
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-muted-foreground">Total Discount:</span>
                <div className="text-right">
                  <p className="font-mono font-medium text-accent">
                    -{formatDualCurrency(order.totalDiscount, settings).usd}
                  </p>
                  {formatDualCurrency(order.totalDiscount, settings).secondary && (
                    <p className="font-mono text-xs text-muted-foreground">-{formatDualCurrency(order.totalDiscount, settings).secondary}</p>
                  )}
                </div>
              </div>
            )}
            
            <div className="border-t-2 border-dashed border-border pt-3 mt-3">
              <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">Total:</span>
                  <div className="text-right" data-testid="receipt-total">
                    <p className="font-mono font-bold text-2xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                      {formatDualCurrency(order.total, settings).usd}
                    </p>
                    {formatDualCurrency(order.total, settings).secondary && (
                      <p className="font-mono font-semibold text-sm text-muted-foreground">
                        {formatDualCurrency(order.total, settings).secondary}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {order.paymentSplits && (() => {
              try {
                const splits: { method: string; amount: number }[] = JSON.parse(order.paymentSplits);
                if (splits.length > 0) {
                  const paymentMethods: Record<string, string> = {
                    cash: "Cash",
                    card: "Card",
                    aba: "ABA",
                    acleda: "Acleda",
                    due: "Due",
                    cash_aba: "Cash And ABA",
                    cash_acleda: "Cash And Acleda",
                  };
                  return (
                    <div className="border-t border-dashed border-border pt-3 mt-3">
                      <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Payment Split:</h4>
                      <div className="space-y-2">
                        {splits.map((split, index) => {
                          const formatted = formatDualCurrency(split.amount, settings);
                          return (
                            <div key={index} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{paymentMethods[split.method] || split.method}:</span>
                              <div className="text-right">
                                <p className="font-mono font-medium">{formatted.usd}</p>
                                {formatted.secondary && (
                                  <p className="font-mono text-xs text-muted-foreground">{formatted.secondary}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              } catch (error) {
                console.error("Failed to parse payment splits:", error);
              }
              return null;
            })()}

            {order.changeDue && order.changeDue > 0 && (
              <div className="border-t-2 border-dashed border-border pt-3 mt-3">
                <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg text-green-700 dark:text-green-400">Change Due:</span>
                    <div className="text-right" data-testid="receipt-change-due">
                      <p className="font-mono font-bold text-2xl text-green-700 dark:text-green-400">
                        {formatDualCurrency(order.changeDue, settings).usd}
                      </p>
                      {formatDualCurrency(order.changeDue, settings).secondary && (
                        <p className="font-mono font-semibold text-sm text-green-600 dark:text-green-500">
                          {formatDualCurrency(order.changeDue, settings).secondary}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Return this amount to customer
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t-2 border-dashed border-border pt-4 mt-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center gap-1 text-primary">
                <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                <p className="text-sm font-semibold">Thank you for your business!</p>
                <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0 flex-shrink-0">
          <Button 
            variant="outline" 
            onClick={onClose} 
            data-testid="button-close-receipt"
            className="gap-2"
          >
            Close
          </Button>
          <Button 
            onClick={handlePrint} 
            className="gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90" 
            data-testid="button-print-receipt"
          >
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
