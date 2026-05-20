import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CreditCard, Banknote, Wallet, Smartphone, X, Check, ChevronsUpDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Customer } from "@shared/schema";
import { cn } from "@/lib/utils";

interface PaymentSplit {
  method: string;
  amount: number;
}

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: string, amountPaid: number, paymentSplits?: PaymentSplit[], customerName?: string, customerPhone?: string, orderDate?: string, dateType?: "date" | "month") => void;
  total: number;
  orderNumber: string;
}

export function PaymentModal({
  open,
  onClose,
  onConfirm,
  total,
  orderNumber,
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState(total.toString());
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [newPaymentMethod, setNewPaymentMethod] = useState("aba");
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [openCombobox, setOpenCombobox] = useState(false);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [orderDateType, setOrderDateType] = useState<"date" | "month" | "">("");
  const [orderDate, setOrderDate] = useState("");
  const [customerSearchValue, setCustomerSearchValue] = useState("");
  const commandListRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch customers list
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
  });

  // Handle customer selection from combobox
  const handleSelectCustomer = (customer: Customer) => {
    setCustomerName(customer.name || "");
    setCustomerPhone(customer.phone || "");
    setOpenCombobox(false);
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setAmountPaid(total.toString());
      setPaymentMethod("cash");
      setPaymentSplits([]);
      setNewPaymentAmount("");
      setNewPaymentMethod("aba");
      setCustomerName("");
      setCustomerPhone("");
      setOpenCombobox(false);
      setIsSplitMode(false);
      setOrderDateType("");
      setOrderDate("");
      setCustomerSearchValue("");
    }
  }, [open, total]);

  // Reset scroll position when search value changes or popover opens
  useEffect(() => {
    if (openCombobox && commandListRef.current) {
      // Reset scroll when popover opens
      const scrollContainer = commandListRef.current;
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    }
  }, [openCombobox]);

  // Reset scroll when search value changes
  useEffect(() => {
    if (openCombobox && commandListRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (commandListRef.current) {
          commandListRef.current.scrollTop = 0;
        }
      });
    }
  }, [customerSearchValue, openCombobox]);

  // Automatically trigger split payment mode for Cash And ABA / Cash And Acleda
  useEffect(() => {
    if (paymentMethod === "cash_aba" && paymentSplits.length === 0) {
      // Pre-populate with Cash and ABA splits
      setPaymentSplits([
        { method: "cash", amount: 0 },
        { method: "aba", amount: 0 }
      ]);
    } else if (paymentMethod === "cash_acleda" && paymentSplits.length === 0) {
      // Pre-populate with Cash and Acleda splits
      setPaymentSplits([
        { method: "cash", amount: 0 },
        { method: "acleda", amount: 0 }
      ]);
    }
  }, [paymentMethod, paymentSplits.length]);

  const handleConfirm = () => {
    if (paymentSplits.length > 0) {
      const totalPaid = paymentSplits.reduce((sum, split) => sum + split.amount, 0);
      
      // Validate that split payments cover at least the order total
      if (totalPaid < total) {
        toast({
          title: "Incomplete Payment",
          description: `Split payments total $${totalPaid.toFixed(2)} but order total is $${total.toFixed(2)}. Please add more payments or adjust amounts.`,
          variant: "destructive",
        });
        return;
      }
      
      onConfirm(
        paymentSplits[0].method, 
        totalPaid, 
        paymentSplits, 
        customerName.trim() || undefined, 
        customerPhone.trim() || undefined,
        orderDate || undefined,
        orderDateType || undefined
      );
    } else {
      onConfirm(
        paymentMethod, 
        parseFloat(amountPaid) || 0, 
        undefined, 
        customerName.trim() || undefined, 
        customerPhone.trim() || undefined,
        orderDate || undefined,
        orderDateType || undefined
      );
    }
    setAmountPaid(total.toString());
    setPaymentMethod("cash");
    setPaymentSplits([]);
    setNewPaymentAmount("");
    setCustomerName("");
    setOrderDateType("");
    setOrderDate("");
  };

  const change = Math.max(0, parseFloat(amountPaid || "0") - total);

  const paymentMethods = [
    { value: "cash", label: "Cash", icon: Banknote },
    { value: "card", label: "Card", icon: CreditCard },
    { value: "aba", label: "ABA", icon: Smartphone },
    { value: "acleda", label: "Acleda", icon: Wallet },
    { value: "due", label: "Due", icon: CreditCard },
    { value: "cash_aba", label: "Cash And ABA", icon: Banknote },
    { value: "cash_acleda", label: "Cash And Acleda", icon: Banknote },
  ];

  const handleAddPaymentSplit = () => {
    const amount = parseFloat(newPaymentAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    setPaymentSplits([...paymentSplits, { method: newPaymentMethod, amount }]);
    setNewPaymentAmount("");
  };

  const handleRemovePaymentSplit = (index: number) => {
    setPaymentSplits(paymentSplits.filter((_, i) => i !== index));
  };

  const handleUpdatePaymentSplit = (index: number, amount: number) => {
    const updatedSplits = [...paymentSplits];
    updatedSplits[index] = { ...updatedSplits[index], amount };
    setPaymentSplits(updatedSplits);
  };

  const totalPaid = paymentSplits.reduce((sum, split) => sum + split.amount, 0);
  const remaining = total - totalPaid;
  const changeDue = totalPaid > total ? totalPaid - total : 0;

  const getPaymentMethodLabel = (method: string) => {
    const found = paymentMethods.find(m => m.value === method);
    return found ? found.label : method;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-payment">
        <DialogHeader>
          <DialogTitle>Process Payment</DialogTitle>
          <DialogDescription>
            Order #{orderNumber} - Complete the payment transaction
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Customer Name (Optional)</Label>
            <div className="flex gap-2">
              <Popover 
                open={openCombobox} 
                onOpenChange={(open) => {
                  setOpenCombobox(open);
                  if (open) {
                    // Reset search and scroll when opening
                    setCustomerSearchValue("");
                    // Reset scroll after a brief delay to ensure DOM is ready
                    setTimeout(() => {
                      if (commandListRef.current) {
                        commandListRef.current.scrollTop = 0;
                      }
                    }, 10);
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="justify-between flex-1"
                    data-testid="button-select-customer"
                  >
                    {customerName || "Select saved customer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command shouldFilter={true}>
                    <CommandInput 
                      placeholder="Search customers..." 
                      value={customerSearchValue}
                      onValueChange={(value) => {
                        setCustomerSearchValue(value);
                        // Reset scroll when search changes
                        if (commandListRef.current) {
                          setTimeout(() => {
                            if (commandListRef.current) {
                              commandListRef.current.scrollTop = 0;
                            }
                          }, 0);
                        }
                      }}
                    />
                    <CommandList 
                      ref={commandListRef}
                    >
                      <CommandEmpty>No customers found.</CommandEmpty>
                      <CommandGroup heading="Saved Customers">
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.name || ""}
                            onSelect={() => handleSelectCustomer(customer)}
                            data-testid={`customer-option-${customer.id}`}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                customerName === customer.name ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{customer.name}</span>
                              {customer.phone && (
                                <span className="text-xs text-muted-foreground">{customer.phone}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Or manually enter customer name:
            </div>
            <Input
              type="text"
              placeholder="Enter new customer name..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              data-testid="input-customer-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-phone">Customer Phone (Optional)</Label>
            <Input
              id="customer-phone"
              type="tel"
              placeholder="Enter customer phone..."
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              data-testid="input-customer-phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="total">Total Amount</Label>
            <div className="text-2xl font-bold font-mono" data-testid="text-payment-total">
              ${total.toFixed(2)}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Order Date (Optional)</Label>
            <Select value={orderDateType} onValueChange={setOrderDateType}>
              <SelectTrigger>
                <SelectValue placeholder="Select date type (default: current date)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">By Date</SelectItem>
                <SelectItem value="month">By Month</SelectItem>
              </SelectContent>
            </Select>
            {orderDateType === "date" && (
              <Input
                type="datetime-local"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="mt-2"
              />
            )}
            {orderDateType === "month" && (
              <Input
                type="month"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="mt-2"
              />
            )}
            {!orderDateType && (
              <p className="text-xs text-muted-foreground mt-1">
                If not selected, current date will be used
              </p>
            )}
          </div>

          {!isSplitMode && paymentSplits.length === 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment-method" data-testid="select-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center gap-2">
                          <method.icon className="w-4 h-4" />
                          <span>{method.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount-paid">Amount Paid</Label>
                <Input
                  id="amount-paid"
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="font-mono"
                  data-testid="input-amount-paid"
                />
              </div>

              {change > 0 && (
                <div className="p-3 bg-muted rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Change:</span>
                    <span className="text-lg font-semibold font-mono text-primary" data-testid="text-change">
                      ${change.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSplitMode(true)}
                  className="w-full"
                  data-testid="button-enable-split"
                >
                  Split Bill
                </Button>
              </div>
            </>
          ) : null}

          {(isSplitMode || paymentSplits.length > 0) && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Split Payment</h3>
                {isSplitMode && paymentSplits.length === 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsSplitMode(false);
                      setPaymentSplits([]);
                    }}
                    data-testid="button-disable-split"
                  >
                    Cancel Split
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="space-y-2">
                <Label htmlFor="new-payment-method">Payment Method</Label>
                <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                  <SelectTrigger id="new-payment-method" data-testid="select-new-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.filter(m => m.value !== 'cash_aba' && m.value !== 'cash_acleda').map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center gap-2">
                          <method.icon className="w-4 h-4" />
                          <span>{method.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-payment-amount">Amount</Label>
                <Input
                  id="new-payment-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newPaymentAmount}
                  onChange={(e) => setNewPaymentAmount(e.target.value)}
                  className="font-mono"
                  data-testid="input-new-payment-amount"
                />
              </div>
            </div>

            <Button 
              type="button" 
              onClick={handleAddPaymentSplit} 
              className="w-full"
              variant="outline"
              data-testid="button-add-payment-split"
            >
              Add Payment
            </Button>

            {paymentSplits.length > 0 && (
              <div className="mt-4 space-y-3">
                <Label>Current Payments</Label>
                <div className="space-y-2">
                  {paymentSplits.map((split, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between gap-3 p-3 bg-muted rounded-md"
                      data-testid={`payment-split-${index}`}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Smartphone className="w-4 h-4" />
                        <span className="font-medium min-w-[80px]">{getPaymentMethodLabel(split.method)}</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={split.amount === 0 ? "0" : split.amount.toString()}
                          onChange={(e) => handleUpdatePaymentSplit(index, parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="font-mono w-32"
                          data-testid={`input-split-amount-${index}`}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePaymentSplit(index)}
                        data-testid={`button-remove-split-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-primary/5 rounded-md space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Order Total:</span>
                    <span className="font-mono">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Paid:</span>
                    <span className="font-mono">${totalPaid.toFixed(2)}</span>
                  </div>
                  {changeDue > 0 ? (
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-green-600">Change Due:</span>
                        <span className="font-mono text-green-600" data-testid="text-change-due">
                          ${changeDue.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        (Return ${changeDue.toFixed(2)} to customer)
                      </p>
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Remaining:</span>
                      <span className={`font-mono ${remaining === 0 ? 'text-green-600' : 'text-primary'}`}>
                        ${remaining.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-payment">
            Cancel
          </Button>
          <Button onClick={handleConfirm} data-testid="button-confirm-payment">
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
