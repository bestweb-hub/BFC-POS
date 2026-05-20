import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Bell, Plus, Grid3x3, FileText, Utensils, ShoppingCart, Filter, X, Scan } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useDebounce } from "@/hooks/use-debounce";
import { ProductCard } from "@/components/product-card";
import { OrderPanel, type OrderItemData } from "@/components/order-panel";
import { PaymentModal } from "@/components/payment-modal";
import { DraftListModal } from "@/components/draft-list-modal";
import { ReceiptPrintModal } from "@/components/receipt-print-modal";
import { useToast } from "@/hooks/use-toast";
import type { Product, Category, Table, Order, OrderItem } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useBranch } from "@/contexts/BranchContext";
import { withBranchId } from "@/lib/branchQuery";

function roundMoneyPos(n: number) {
  return Math.round(n * 100) / 100;
}

interface ProductsResponse {
  products: Product[];
  total: number;
}

export default function POS() {
  const { selectedBranchId } = useBranch();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [orderItems, setOrderItems] = useState<OrderItemData[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [diningOption, setDiningOption] = useState("dine-in");
  
  // Debug: Log when orderItems changes
  useEffect(() => {
    console.log("=== orderItems state changed ===");
    console.log("orderItems:", orderItems);
    console.log("orderItems length:", orderItems.length);
    console.log("orderItems type:", typeof orderItems);
    console.log("orderItems is array:", Array.isArray(orderItems));
    if (orderItems.length > 0) {
      console.log("First item:", orderItems[0]);
      console.log("First item product:", orderItems[0].product);
    }
    console.log("================================");
  }, [orderItems]);
  const [searchInPacking, setSearchInPacking] = useState("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [draftListModalOpen, setDraftListModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [currentOrderNumber, setCurrentOrderNumber] = useState(() => 
    `${Math.floor(Math.random() * 100)}`
  );
  const [receiptData, setReceiptData] = useState<any>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [manualDiscount, setManualDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [appliedSubscription, setAppliedSubscription] = useState<{
    cardId: string;
    barcode: string;
    customerId: string;
    customerName: string;
    discountType: "percentage" | "amount";
    discountValue: number;
  } | null>(null);
  const [orderPanelOpen, setOrderPanelOpen] = useState(false);
  const [sizeSelectionDialogOpen, setSizeSelectionDialogOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  
  // Additional filters
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  
  const isDesktop = useIsDesktop();
  const { toast } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [barcodeTimeout, setBarcodeTimeout] = useState<NodeJS.Timeout | null>(null);

  // Handle discount changes properly to avoid race conditions
  const handleDiscountChange = (value: number, type: 'amount' | 'percentage') => {
    setDiscountType(type);
    setManualDiscount(value);
  };

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
  });

  const isScannerEnabled = settings?.enableBarcodeScanner === "true";
  const scanDelay = settings?.barcodeScanDelay || 200;
  const beepSound = settings?.barcodeBeepSound === "true";

  // Fetch sold quantities to calculate available stock
  const { data: soldQuantities = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/inventory/sold-quantities"],
  });

  // Infinite query for paginated products
  const {
    data: productsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: productsLoading,
    refetch,
  } = useInfiniteQuery<ProductsResponse>({
    queryKey: [
      "/api/products",
      {
        branchId: selectedBranchId,
        categoryId: selectedCategory,
        search: debouncedSearchQuery,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        inStock: stockFilter === "inStock" ? true : stockFilter === "outOfStock" ? false : undefined,
      },
    ],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        limit: "50",
        offset: String(pageParam),
      });
      
      if (selectedCategory) params.append("categoryId", selectedCategory);
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
      if (minPrice) params.append("minPrice", minPrice);
      if (maxPrice) params.append("maxPrice", maxPrice);
      if (stockFilter === "inStock") params.append("inStock", "true");
      if (stockFilter === "outOfStock") params.append("inStock", "false");
      
      const url = withBranchId(`/api/products?${params.toString()}`, selectedBranchId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.products.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    initialPageParam: 0,
  });

  // Flatten all products from all pages
  const allProducts = productsData?.pages.flatMap((page) => page.products) ?? [];
  const totalProducts = productsData?.pages[0]?.total ?? 0;

  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ["/api/tables", { branchId: selectedBranchId }],
    queryFn: async () => {
      const res = await fetch(withBranchId("/api/tables", selectedBranchId), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tables");
      return res.json();
    },
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders", { branchId: selectedBranchId }],
    queryFn: async () => {
      const res = await fetch(withBranchId("/api/orders", selectedBranchId), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
  });

  const draftOrders = orders.filter((order) => order.status === "draft");

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return await apiRequest("POST", "/api/orders", orderData);
    },
    onSuccess: () => {
      // Invalidate orders and products (all branches)
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      
      // Invalidate due management queries for real-time updates
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      
      // Invalidate inventory queries
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/adjustments"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/inventory/low-stock');
        }
      });
      
      // Invalidate all dashboard queries for real-time updates
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/dashboard');
        }
      });
      
      // Only clear cart if it's a new draft, not when updating
      if (!currentDraftId) {
        setOrderItems([]);
        setSelectedTable(null);
        setCurrentOrderNumber("");
        setCurrentDraftId(null);
        setManualDiscount(0);
        setDiscountType('amount');
        setAppliedSubscription(null);
      }
      
      toast({
        title: "Success",
        description: currentDraftId ? "Draft saved successfully" : "Order processed successfully",
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, orderData }: { orderId: string; orderData: any }) => {
      const response = await apiRequest("PATCH", `/api/orders/${orderId}`, orderData);
      return await response.json();
    },
    onSuccess: (updatedOrder) => {
      // Invalidate orders and products
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/adjustments"] });
      
      // Update order number if it changed (shouldn't happen, but just in case)
      if (updatedOrder?.orderNumber) {
        setCurrentOrderNumber(updatedOrder.orderNumber);
      }
      
      toast({
        title: "Success",
        description: "Draft order updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update draft order",
        variant: "destructive",
      });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return await apiRequest("DELETE", `/api/orders/${orderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Draft order deleted",
      });
    },
  });

  const handleAddToOrder = (product: Product) => {
    // Calculate available stock (quantity - sold)
    const quantity = parseFloat(product.quantity || "0");
    const sold = soldQuantities[product.id] || 0;
    const availableStock = Math.max(0, quantity - sold);
    
    // Check available stock before adding
    if (availableStock <= 0) {
      toast({
        title: "Out of Stock",
        description: `${product.name} is out of stock and cannot be added to the order.`,
        variant: "destructive",
      });
      return;
    }
    
    // Check if product has size prices (for any unit type)
    const sizePrices = product.sizePrices as Record<string, string> | null | undefined;
    const hasSizePrices = sizePrices && Object.keys(sizePrices).length > 0;
    
    if (hasSizePrices) {
      // Show size selection dialog
      setPendingProduct(product);
      setSelectedSize("");
      setSizeSelectionDialogOpen(true);
    } else {
      // Add directly without size selection
      addProductToOrder(product, undefined);
    }
  };

  const addProductToOrder = (product: Product, size: string | undefined) => {
    // Calculate available stock (quantity - sold)
    const quantity = parseFloat(product.quantity || "0");
    const sold = soldQuantities[product.id] || 0;
    const availableStock = Math.max(0, quantity - sold);
    
    // Check available stock before adding
    if (availableStock <= 0) {
      toast({
        title: "Out of Stock",
        description: `${product.name} is out of stock and cannot be added to the order.`,
        variant: "destructive",
      });
      return;
    }

    // Calculate price based on size if provided (for any unit type)
    let itemPrice = product.price;
    if (size) {
      const sizePrices = product.sizePrices as Record<string, string> | null | undefined;
      if (sizePrices && sizePrices[size]) {
        itemPrice = sizePrices[size];
      }
    }

    // Create product with adjusted price for display
    const productWithPrice = {
      ...product,
      price: itemPrice,
    };

    setOrderItems((prev) => {
      // Check if same product with same size already exists
      // If product has size prices, match by both productId and selectedSize
      // Otherwise, match by productId only
      const hasSizePrices = product.sizePrices && Object.keys(product.sizePrices as Record<string, string>).length > 0;
      const existing = prev.find((item) => {
        if (item.product.id !== product.id) return false;
        // If product has size pricing, match by size; otherwise any size is fine
        if (hasSizePrices) {
          return item.selectedSize === size;
        }
        return true; // No size pricing, match by product only
      });
      
      if (existing) {
        // Check if adding one more would exceed available stock
        const newQuantity = existing.quantity + 1;
        if (newQuantity > availableStock) {
          toast({
            title: "Insufficient Stock",
            description: `Only ${availableStock.toFixed(2)} ${product.unit} available in stock.`,
            variant: "destructive",
          });
          return prev;
        }
        return prev.map((item) => {
          const matchesProduct = item.product.id === product.id;
          const matchesSize = hasSizePrices ? item.selectedSize === size : true;
          return matchesProduct && matchesSize
            ? { ...item, quantity: newQuantity }
            : item;
        });
      }
      
      return [...prev, { 
        product: productWithPrice, 
        quantity: 1,
        itemDiscount: undefined,
        itemDiscountType: 'amount' as const,
        selectedSize: size,
      }];
    });
  };

  const handleSizeSelection = () => {
    if (pendingProduct && selectedSize) {
      addProductToOrder(pendingProduct, selectedSize);
      setSizeSelectionDialogOpen(false);
      setPendingProduct(null);
      setSelectedSize("");
    } else {
      toast({
        title: "Size Required",
        description: "Please select a size",
        variant: "destructive",
      });
    }
  };

  // Barcode scanner handler
  useEffect(() => {
    // Only enable scanner if it's enabled in settings
    if (!isScannerEnabled) {
      return;
    }

    const playScanBeep = () => {
      if (!beepSound) return;
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = "sine";
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      } catch {
        /* ignore */
      }
    };

    const handleBarcodeScan = async (event: KeyboardEvent) => {
      // Don't interfere if user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        (target as any).closest?.('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }

      // Barcode scanners typically send characters very quickly (within 50-100ms)
      // We accumulate characters and process when there's a pause or Enter key
      
      if (event.key === "Enter" && barcodeBuffer.length > 0) {
        event.preventDefault();
        const scannedBarcode = barcodeBuffer.trim();
        setBarcodeBuffer("");
        
        if (barcodeTimeout) {
          clearTimeout(barcodeTimeout);
          setBarcodeTimeout(null);
        }
        
        // Only process if barcode is reasonable length (barcode scanners usually send 8+ characters)
        if (scannedBarcode.length < 3) {
          return;
        }
        
        // Look for product by barcode, then subscription card
        try {
          const response = await fetch(`/api/products/barcode/${encodeURIComponent(scannedBarcode)}`, {
            credentials: "include",
          });
          
          if (response.ok) {
            const product = await response.json();
            handleAddToOrder(product);
            playScanBeep();
            toast({
              title: "Product Added",
              description: `${product.name} added to cart`,
            });
          } else {
            const product = allProducts.find(p => p.id === scannedBarcode || p.barcode === scannedBarcode);
            if (product) {
              handleAddToOrder(product);
              playScanBeep();
              toast({
                title: "Product Added",
                description: `${product.name} added to cart`,
              });
            } else if (settings?.subscriptionProgramEnabled === "true") {
              const subRes = await fetch(
                `/api/subscription-cards/lookup/${encodeURIComponent(scannedBarcode)}`,
                { credentials: "include" }
              );
              if (subRes.ok) {
                const data = await subRes.json();
                setAppliedSubscription({
                  cardId: data.cardId,
                  barcode: data.barcode,
                  customerId: data.customerId,
                  customerName: data.customerName,
                  discountType: data.discountType,
                  discountValue: data.discountValue,
                });
                playScanBeep();
                toast({
                  title: "Subscription card applied",
                  description: `${data.customerName} — discount active for this sale`,
                });
              } else {
                toast({
                  title: "Not found",
                  description: `No product or active subscription card for: ${scannedBarcode}`,
                  variant: "destructive",
                });
              }
            } else {
              toast({
                title: "Product Not Found",
                description: `No product found with barcode: ${scannedBarcode}`,
                variant: "destructive",
              });
            }
          }
        } catch (error) {
          console.error("Error fetching product by barcode:", error);
          toast({
            title: "Error",
            description: "Failed to scan",
            variant: "destructive",
          });
        }
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // Accumulate characters (barcode scanners send characters quickly)
        setBarcodeBuffer(prev => prev + event.key);
        
        // Clear buffer after configured delay (barcode scanners send all characters quickly)
        if (barcodeTimeout) {
          clearTimeout(barcodeTimeout);
        }
        const timeout = setTimeout(() => {
          setBarcodeBuffer("");
        }, scanDelay);
        setBarcodeTimeout(timeout);
      }
    };

    window.addEventListener("keydown", handleBarcodeScan);

    return () => {
      window.removeEventListener("keydown", handleBarcodeScan);
      if (barcodeTimeout) {
        clearTimeout(barcodeTimeout);
      }
    };
  }, [barcodeBuffer, barcodeTimeout, allProducts, toast, handleAddToOrder, isScannerEnabled, scanDelay, beepSound, soldQuantities, settings?.subscriptionProgramEnabled]);

  const handleUpdateQuantity = (productId: string, quantity: number, selectedSize?: string) => {
    if (quantity < 1) return;
    
    setOrderItems((prev) =>
      prev.map((item) => {
        // If product has size pricing, match by both productId and selectedSize
        // Otherwise, match by productId only
        const hasSizePrices = item.product.sizePrices && Object.keys(item.product.sizePrices as Record<string, string>).length > 0;
        const matchesProduct = item.product.id === productId;
        const matchesSize = hasSizePrices 
          ? (selectedSize !== undefined && item.selectedSize === selectedSize)
          : true;
        
        if (matchesProduct && matchesSize) {
          // Calculate available stock (quantity - sold)
          const productQuantity = parseFloat(item.product.quantity || "0");
          const sold = soldQuantities[item.product.id] || 0;
          const availableStock = Math.max(0, productQuantity - sold);
          
          // Check available stock before updating quantity
          if (quantity > availableStock) {
            toast({
              title: "Insufficient Stock",
              description: `Only ${availableStock.toFixed(2)} ${item.product.unit} available in stock.`,
              variant: "destructive",
            });
            return item; // Return unchanged item
          }
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (productId: string, selectedSize?: string) => {
    setOrderItems((prev) => 
      prev.filter((item) => {
        // If product has size pricing, match by both productId and selectedSize
        // Otherwise, match by productId only
        const hasSizePrices = item.product.sizePrices && Object.keys(item.product.sizePrices as Record<string, string>).length > 0;
        if (hasSizePrices && selectedSize !== undefined) {
          return !(item.product.id === productId && item.selectedSize === selectedSize);
        }
        // No size pricing, match by productId only
        return item.product.id !== productId;
      })
    );
  };

  const handleUpdateItemDiscount = (productId: string, discount: number, discountType: 'amount' | 'percentage', selectedSize?: string) => {
    setOrderItems((prev) =>
      prev.map((item) => {
        // If product has size pricing, match by both productId and selectedSize
        // Otherwise, match by productId only
        const hasSizePrices = item.product.sizePrices && Object.keys(item.product.sizePrices as Record<string, string>).length > 0;
        const matchesProduct = item.product.id === productId;
        const matchesSize = hasSizePrices 
          ? (selectedSize !== undefined && item.selectedSize === selectedSize)
          : true;
        
        return matchesProduct && matchesSize
          ? { ...item, itemDiscount: discount, itemDiscountType: discountType }
          : item;
      })
    );
  };

  const handleClearOrder = () => {
    setOrderItems([]);
    setManualDiscount(0);
    setDiscountType('amount');
    setCurrentDraftId(null);
    setAppliedSubscription(null);
  };

  // Helper function to get item price (with size support)
  const getItemPrice = (item: OrderItemData): number => {
    // Use size-specific price if available (for any unit type), otherwise use base price
    if (item.selectedSize) {
      const sizePrices = item.product.sizePrices as Record<string, string> | null | undefined;
      if (sizePrices && sizePrices[item.selectedSize]) {
        return parseFloat(sizePrices[item.selectedSize]);
      }
    }
    return parseFloat(item.product.price);
  };

  const calculateItemTotal = (item: OrderItemData): number => {
    const itemPrice = getItemPrice(item);
    const itemSubtotal = itemPrice * item.quantity;
    
    if (item.itemDiscount !== undefined && item.itemDiscount > 0) {
      const itemDiscountAmount = item.itemDiscountType === 'percentage'
        ? (itemSubtotal * item.itemDiscount) / 100
        : item.itemDiscount;
      return Math.max(0, itemSubtotal - itemDiscountAmount);
    }
    
    return itemSubtotal;
  };

  // Helper function to calculate subtotal with per-item discounts
  const calculateSubtotal = (items: OrderItemData[]): number => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  // Helper function to calculate original subtotal (before discounts)
  const calculateOriginalSubtotal = (items: OrderItemData[]): number => {
    return items.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0);
  };

  // Helper function to calculate total item discounts
  const calculateTotalItemDiscounts = (items: OrderItemData[]): number => {
    return items.reduce((sum, item) => {
      if (item.itemDiscount !== undefined && item.itemDiscount > 0) {
        const itemPrice = getItemPrice(item);
        const itemSubtotal = itemPrice * item.quantity;
        const itemDiscountAmount = item.itemDiscountType === 'percentage'
          ? (itemSubtotal * item.itemDiscount) / 100
          : item.itemDiscount;
        return sum + itemDiscountAmount;
      }
      return sum;
    }, 0);
  };

  function computeCurrentTotals() {
    const subtotal = calculateSubtotal(orderItems);
    let subscriptionDiscountAmount = 0;
    if (appliedSubscription) {
      if (appliedSubscription.discountType === "percentage") {
        subscriptionDiscountAmount = roundMoneyPos(
          Math.min(subtotal, (subtotal * appliedSubscription.discountValue) / 100)
        );
      } else {
        subscriptionDiscountAmount = roundMoneyPos(
          Math.min(subtotal, appliedSubscription.discountValue)
        );
      }
    }
    const afterSubscription = roundMoneyPos(subtotal - subscriptionDiscountAmount);
    const globalDiscountAmount =
      discountType === "percentage"
        ? roundMoneyPos((afterSubscription * manualDiscount) / 100)
        : roundMoneyPos(Math.min(manualDiscount, afterSubscription));
    const total = roundMoneyPos(afterSubscription - globalDiscountAmount);
    return { subtotal, subscriptionDiscountAmount, afterSubscription, globalDiscountAmount, total };
  }

  const handleSaveDraft = () => {
    const { subtotal, subscriptionDiscountAmount, total } = computeCurrentTotals();

    const orderData = {
      tableId: selectedTable,
      diningOption,
      subtotal: subtotal.toString(),
      discount: manualDiscount.toString(),
      discountType: discountType,
      total: total.toString(),
      subscriptionCardId: appliedSubscription?.cardId ?? null,
      subscriptionDiscount: subscriptionDiscountAmount.toFixed(2),
      status: "draft",
      items: orderItems.map((item) => {
        const itemPrice = getItemPrice(item);
        return {
          productId: item.product.id,
          quantity: item.quantity,
          price: itemPrice.toString(),
          total: calculateItemTotal(item).toString(),
          itemDiscount: item.itemDiscount?.toString() || "0",
          itemDiscountType: item.itemDiscountType || 'amount',
          selectedSize: item.selectedSize || undefined,
        };
      }),
    };

    // If editing an existing draft, update it instead of creating a new one
    if (currentDraftId) {
      updateOrderMutation.mutate({
        orderId: currentDraftId,
        orderData,
      });
    } else {
      createOrderMutation.mutate(orderData);
    }
  };

  const handleOpenDraftList = () => {
    setDraftListModalOpen(true);
  };

  const handleEditDraft = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      toast({
        title: "Error",
        description: "Order not found",
        variant: "destructive",
      });
      return;
    }

    try {
      // Fetch items with products
      const itemsResponse = await apiRequest("GET", `/api/orders/${orderId}/items`);
      const items = await itemsResponse.json() as Array<OrderItem & { product?: Product; productName?: string }>;
      
      console.log("API Response - Items:", items);
      console.log("First item:", items[0]);
      console.log("First item product:", items[0]?.product);
      
      if (!items || items.length === 0) {
        toast({
          title: "No Items",
          description: "This draft order has no items",
          variant: "destructive",
        });
        return;
      }

      // Map items to OrderItemData format
      const restoredItems: OrderItemData[] = [];
      
      for (const item of items) {
        // Use product directly from API response if available
        let product: Product | undefined = item.product as Product | undefined;
        
        // If product is missing from API response, try to find it in allProducts
        if (!product || !product.id) {
          console.warn("Product missing from API response, looking in allProducts:", item.productId);
          product = allProducts.find(p => p.id === item.productId);
        }
        
        if (!product) {
          console.error(`Product ${item.productId} not found. Item:`, item);
          console.error("Available products count:", allProducts.length);
          continue;
        }
        
        // Use the product directly - it should already have all required fields from the API
        // Get the correct price based on selected size (for any unit type)
        let itemPrice = parseFloat(item.price);
        const selectedSize = (item as any).selectedSize;
        if (selectedSize) {
          const sizePrices = product.sizePrices as Record<string, string> | null | undefined;
          if (sizePrices && sizePrices[selectedSize]) {
            itemPrice = parseFloat(sizePrices[selectedSize]);
          }
        }
        
        // Create product with correct price
        const productWithPrice = {
          ...product,
          price: itemPrice.toString(),
        };
        
        const restoredItem: OrderItemData = {
          product: productWithPrice as Product,
          quantity: item.quantity,
          itemDiscount: item.itemDiscount && parseFloat(item.itemDiscount) > 0 
            ? parseFloat(item.itemDiscount) 
            : undefined,
          itemDiscountType: (item.itemDiscountType as 'amount' | 'percentage') || undefined,
          selectedSize: selectedSize || undefined,
        };
        
        console.log("Created restored item:", restoredItem);
        restoredItems.push(restoredItem);
      }

      console.log("Restored items:", restoredItems);
      console.log("Restored items count:", restoredItems.length);

      if (restoredItems.length === 0) {
        toast({
          title: "Error",
          description: "Could not load items: products not found. Please refresh the page and try again.",
          variant: "destructive",
        });
        return;
      }

      // Set all state at once to avoid race conditions
      console.log("About to set order items:", restoredItems);
      console.log("Restored items count:", restoredItems.length);
      console.log("First restored item:", restoredItems[0]);
      console.log("First restored item product:", restoredItems[0]?.product);
      
      // Use React's batching to set all state together
      // Create a new array reference to ensure React detects the change
      const itemsToSet = [...restoredItems];
      console.log("Items to set (new array):", itemsToSet);
      
      setOrderItems(itemsToSet);
      setSelectedTable(order.tableId);
      setDiningOption(order.diningOption);
      setCurrentOrderNumber(order.orderNumber);
      setCurrentDraftId(orderId);
      setManualDiscount(parseFloat(order.discount) || 0);
      setDiscountType((order.discountType as 'amount' | 'percentage') || 'amount');
      const subCardId = order.subscriptionCardId;
      if (subCardId) {
        try {
          const subRes = await fetch(`/api/subscription-cards/by-id/${subCardId}`, { credentials: "include" });
          if (subRes.ok) {
            const data = await subRes.json();
            setAppliedSubscription({
              cardId: data.cardId,
              barcode: data.barcode,
              customerId: data.customerId,
              customerName: data.customerName,
              discountType: data.discountType,
              discountValue: data.discountValue,
            });
          } else {
            setAppliedSubscription(null);
          }
        } catch {
          setAppliedSubscription(null);
        }
      } else {
        setAppliedSubscription(null);
      }
      setDraftListModalOpen(false);
      
      toast({
        title: "Draft Loaded",
        description: `Loaded ${restoredItems.length} item(s) into cart`,
      });
    } catch (error) {
      console.error("Error loading draft:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load draft order",
        variant: "destructive",
      });
    }
  };

  const handlePrintDraft = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      toast({
        title: "Error",
        description: "Order not found",
        variant: "destructive",
      });
      return;
    }

    try {
      // Fetch order with items (includes full product objects)
      const response = await apiRequest("GET", `/api/orders/${orderId}`);
      const orderData = await response.json() as Order & { items?: (OrderItem & { product?: Product })[] };
      
      // If items are not in order response, fetch separately
      let items: (OrderItem & { product?: Product })[];
      if (orderData.items && orderData.items.length > 0 && orderData.items[0]?.product) {
        items = orderData.items;
      } else {
        const itemsResponse = await apiRequest("GET", `/api/orders/${orderId}/items`);
        items = await itemsResponse.json() as Array<OrderItem & { product?: Product }>;
      }
      
      if (!items || items.length === 0) {
        toast({
          title: "No Items",
          description: "This draft order has no items to print",
          variant: "destructive",
        });
        return;
      }

      // Map items for receipt - use product from API or fallback to allProducts
      const receiptItems = items
        .filter(item => {
          if (!item.product) {
            const product = allProducts.find(p => p.id === item.productId);
            if (product) {
              (item as any).product = product;
              return true;
            }
            return false;
          }
          return true;
        })
        .map((item) => {
          const product = item.product || allProducts.find(p => p.id === item.productId);
          if (!product) {
            throw new Error(`Product ${item.productId} not found`);
          }
          
            // Get the correct price based on selected size (for any unit type)
            let itemPrice = parseFloat(item.price);
            const selectedSize = (item as any).selectedSize;
            if (selectedSize) {
              const sizePrices = product.sizePrices as Record<string, string> | null | undefined;
              if (sizePrices && sizePrices[selectedSize]) {
                itemPrice = parseFloat(sizePrices[selectedSize]);
              }
            }
            
            // Create product with correct price
            const productWithPrice = {
              ...product,
              price: itemPrice.toString(),
            };
            
            return {
              product: productWithPrice,
              quantity: item.quantity,
              price: item.price,
              total: item.total,
              itemDiscount: item.itemDiscount,
              itemDiscountType: item.itemDiscountType,
              selectedSize: selectedSize || undefined,
            };
        });

      setReceiptData({
        orderNumber: orderData.orderNumber || order.orderNumber,
        items: receiptItems,
        subtotal: parseFloat(orderData.subtotal || order.subtotal),
        discount: parseFloat(orderData.discount || order.discount),
        total: parseFloat(orderData.total || order.total),
        tableId: orderData.tableId || order.tableId,
        diningOption: orderData.diningOption || order.diningOption,
        paymentMethod: orderData.paymentMethod || undefined,
        paymentSplits: orderData.paymentSplits ?? undefined,
      });
      setReceiptModalOpen(true);
      setDraftListModalOpen(false);
    } catch (error) {
      console.error("Error loading draft for printing:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load draft order for printing",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDraft = (orderId: string) => {
    deleteOrderMutation.mutate(orderId);
  };

  // Listen for loadDraft event from header
  useEffect(() => {
    const handleLoadDraft = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { orderId } = customEvent.detail;
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      try {
        const response = await apiRequest("GET", `/api/orders/${orderId}/items`);
        const orderItemsData = await response.json() as OrderItem[];
        
        const productsMap = new Map(allProducts.map((p) => [p.id, p]));
        const restoredItems: OrderItemData[] = orderItemsData
          .map((item) => {
            const product = productsMap.get(item.productId);
            if (!product) return null;
            
            // Get the correct price based on selected size (for any unit type)
            let itemPrice = parseFloat(item.price);
            const selectedSize = (item as any).selectedSize;
            if (selectedSize) {
              const sizePrices = product.sizePrices as Record<string, string> | null | undefined;
              if (sizePrices && sizePrices[selectedSize]) {
                itemPrice = parseFloat(sizePrices[selectedSize]);
              }
            }
            
            // Create product with correct price
            const productWithPrice = {
              ...product,
              price: itemPrice.toString(),
            };
            
            return {
              product: productWithPrice,
              quantity: item.quantity,
              itemDiscount: item.itemDiscount ? parseFloat(item.itemDiscount) : undefined,
              itemDiscountType: item.itemDiscountType as 'amount' | 'percentage' | undefined,
              selectedSize: selectedSize || undefined,
            };
          })
          .filter((item): item is OrderItemData => item !== null);

        setOrderItems(restoredItems);
        setSelectedTable(order.tableId);
        setDiningOption(order.diningOption);
        setCurrentOrderNumber(order.orderNumber);
        setCurrentDraftId(orderId);
        setManualDiscount(parseFloat(order.discount) || 0);
        setDiscountType((order.discountType as 'amount' | 'percentage') || 'amount');
        const subCardId = order.subscriptionCardId;
        if (subCardId) {
          try {
            const subRes = await fetch(`/api/subscription-cards/by-id/${subCardId}`, { credentials: "include" });
            if (subRes.ok) {
              const data = await subRes.json();
              setAppliedSubscription({
                cardId: data.cardId,
                barcode: data.barcode,
                customerId: data.customerId,
                customerName: data.customerName,
                discountType: data.discountType,
                discountValue: data.discountValue,
              });
            } else {
              setAppliedSubscription(null);
            }
          } catch {
            setAppliedSubscription(null);
          }
        } else {
          setAppliedSubscription(null);
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load draft order",
          variant: "destructive",
        });
      }
    };

    window.addEventListener('loadDraft', handleLoadDraft);
    return () => {
      window.removeEventListener('loadDraft', handleLoadDraft);
    };
  }, [orders, allProducts, toast]);

  // Listen for printDraft event from header
  useEffect(() => {
    const handlePrintDraftEvent = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { orderId } = customEvent.detail;
      // Use the handlePrintDraft function we already have
      handlePrintDraft(orderId);
    };

    window.addEventListener('printDraft', handlePrintDraftEvent);
    return () => {
      window.removeEventListener('printDraft', handlePrintDraftEvent);
    };
  }, [orders, allProducts, toast]);

  const handleProcessPayment = (type: "kot" | "bill" | "print") => {
    if (type === "kot") {
      const originalSubtotal = calculateOriginalSubtotal(orderItems);
      const totalItemDiscounts = calculateTotalItemDiscounts(orderItems);
      const { subtotal, subscriptionDiscountAmount, globalDiscountAmount, total } = computeCurrentTotals();
      const totalDiscount = totalItemDiscounts + subscriptionDiscountAmount + globalDiscountAmount;

      setReceiptData({
        orderNumber: currentOrderNumber,
        items: orderItems.map((item) => {
          const itemPrice = getItemPrice(item);
          return {
            product: item.product,
            quantity: item.quantity,
            price: itemPrice.toString(),
            total: calculateItemTotal(item).toString(),
            itemDiscount: item.itemDiscount,
            itemDiscountType: item.itemDiscountType,
            selectedSize: item.selectedSize,
          };
        }),
        originalSubtotal,
        itemDiscounts: totalItemDiscounts,
        subtotal,
        subscriptionDiscount: subscriptionDiscountAmount,
        discount: globalDiscountAmount,
        discountType,
        discountRaw: manualDiscount,
        totalDiscount,
        total,
        tableId: selectedTable,
        diningOption,
      });
      setReceiptModalOpen(true);
    } else if (type === "print") {
      setPaymentModalOpen(true);
    }
  };

  const handleConfirmPayment = async (paymentMethod: string, amountPaid: number, paymentSplits?: { method: string; amount: number }[], customerName?: string, customerPhone?: string, orderDate?: string, dateType?: "date" | "month") => {
    const originalSubtotal = calculateOriginalSubtotal(orderItems);
    const totalItemDiscounts = calculateTotalItemDiscounts(orderItems);
    const { subtotal, subscriptionDiscountAmount, globalDiscountAmount, total } = computeCurrentTotals();
    const draftIdToDelete = currentDraftId;

    const totalPaidAmount = paymentSplits && paymentSplits.length > 0
      ? paymentSplits.reduce((sum, split) => sum + split.amount, 0)
      : amountPaid;
    const changeDue = totalPaidAmount > total ? totalPaidAmount - total : 0;

    // Calculate payment status and amounts based on payment splits
    let finalPaymentStatus = "paid";
    let paidAmount = total.toString();
    let dueAmount = "0";
    
    if (paymentSplits && paymentSplits.length > 0) {
      const dueSplit = paymentSplits.find(split => split.method === "due");
      const paidSplit = paymentSplits.find(split => split.method !== "due");
      
      if (dueSplit && dueSplit.amount > 0) {
        // Has due amount
        const paidTotal = paymentSplits
          .filter(split => split.method !== "due")
          .reduce((sum, split) => sum + split.amount, 0);
        
        paidAmount = paidTotal.toString();
        dueAmount = dueSplit.amount.toString();
        finalPaymentStatus = paidTotal > 0 ? "partial" : "due";
      } else {
        // Fully paid
        paidAmount = totalPaidAmount.toString();
        dueAmount = "0";
        finalPaymentStatus = "paid";
      }
    } else if (paymentMethod === "due") {
      // Single payment method is due
      paidAmount = "0";
      dueAmount = total.toString();
      finalPaymentStatus = "due";
    } else {
      // Fully paid with single method
      paidAmount = totalPaidAmount.toString();
      dueAmount = "0";
      finalPaymentStatus = "paid";
    }

    // Calculate order date based on dateType
    let finalOrderDate: Date | undefined;
    if (orderDate && dateType) {
      if (dateType === "month") {
        // Use 1st day of the selected month
        const [year, month] = orderDate.split("-");
        finalOrderDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0, 0));
      } else {
        // Use the exact date selected
        finalOrderDate = new Date(orderDate);
      }
    }
    // If no date selected, createdAt will default to current date in backend

    const orderData: any = {
      branchId: selectedBranchId,
      tableId: selectedTable,
      diningOption,
      subtotal: subtotal.toString(),
      discount: manualDiscount.toString(),
      discountType: discountType,
      total: total.toString(),
      status: "completed",
      paymentMethod: paymentSplits && paymentSplits.length > 0 
        ? paymentSplits.map(s => s.method).join(",") 
        : paymentMethod,
      paymentStatus: finalPaymentStatus,
      paidAmount: paidAmount,
      items: orderItems.map((item) => {
        const itemPrice = getItemPrice(item);
        return {
          productId: item.product.id,
          quantity: item.quantity,
          price: itemPrice.toString(),
          total: calculateItemTotal(item).toString(),
          itemDiscount: item.itemDiscount?.toString() || "0",
          itemDiscountType: item.itemDiscountType || 'amount',
          selectedSize: item.selectedSize || undefined,
        };
      }),
      orderSource: "pos",
      subscriptionCardId: appliedSubscription?.cardId ?? null,
      subscriptionDiscount: subscriptionDiscountAmount.toFixed(2),
    };
    
    // Add createdAt if order date is provided
    if (finalOrderDate) {
      orderData.createdAt = finalOrderDate.toISOString();
    }

    // Only include dueAmount if there's an actual due amount
    if (dueAmount !== "0" && parseFloat(dueAmount) > 0) {
      orderData.dueAmount = dueAmount;
    }

    if (customerName) {
      orderData.customerName = customerName;
    }

    if (customerPhone) {
      orderData.customerPhone = customerPhone;
    }

    if (paymentSplits && paymentSplits.length > 0) {
      orderData.paymentSplits = JSON.stringify(paymentSplits);
    }

    const totalDiscount = totalItemDiscounts + subscriptionDiscountAmount + globalDiscountAmount;
    const receiptPayload = {
      items: orderItems.map((item) => {
        const itemPrice = getItemPrice(item);
        return {
          product: item.product,
          quantity: item.quantity,
          price: itemPrice.toString(),
          total: calculateItemTotal(item).toString(),
          itemDiscount: item.itemDiscount,
          itemDiscountType: item.itemDiscountType,
          selectedSize: item.selectedSize,
        };
      }),
      originalSubtotal,
      itemDiscounts: totalItemDiscounts,
      subtotal,
      subscriptionDiscount: subscriptionDiscountAmount,
      discount: globalDiscountAmount,
      totalDiscount,
      total: total,
      tableId: selectedTable,
      diningOption,
      paymentMethod: paymentSplits && paymentSplits.length > 0 ? undefined : paymentMethod,
      paymentSplits: paymentSplits && paymentSplits.length > 0 ? JSON.stringify(paymentSplits) : undefined,
      changeDue: changeDue > 0 ? changeDue : undefined,
    };

    setPaymentModalOpen(false);

    const openReceiptWithOrderNumber = (orderNumber: string) => {
      setReceiptData({ ...receiptPayload, orderNumber });
      setReceiptModalOpen(true);
    };

    const resetCartAndNewOrder = () => {
      setCurrentDraftId(null);
      setOrderItems([]);
      setSelectedTable(null);
      setCurrentOrderNumber("");
      setManualDiscount(0);
      setDiscountType("amount");
      setAppliedSubscription(null);
    };

    const runSaveAndReceipt = async () => {
      try {
        if (currentDraftId) {
          const updatedOrder = await updateOrderMutation.mutateAsync({
            orderId: currentDraftId,
            orderData,
          });
          const invoiceNumber = updatedOrder?.orderNumber ?? currentOrderNumber;
          openReceiptWithOrderNumber(String(invoiceNumber));
          resetCartAndNewOrder();
          queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
          toast({ title: "Success", description: "Order processed successfully" });
        } else {
          const res = await createOrderMutation.mutateAsync(orderData);
          const createdOrder = await res.json();
          const invoiceNumber = createdOrder?.orderNumber ?? currentOrderNumber;
          openReceiptWithOrderNumber(String(invoiceNumber));
          resetCartAndNewOrder();
          queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
          toast({ title: "Success", description: "Order processed successfully" });
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: error?.message || "Failed to save order",
          variant: "destructive",
        });
      }
    };
    runSaveAndReceipt();
  };

  const handlePrintReceipt = () => {
    toast({
      title: "Receipt Printed",
      description: "Receipt has been sent to printer",
    });
  };

  const handleNewOrder = () => {
    setOrderItems([]);
    setSelectedTable(null);
    setDiningOption("dine-in");
    setCurrentOrderNumber("");
    setCurrentDraftId(null);
    setManualDiscount(0);
    setDiscountType('amount');
    setAppliedSubscription(null);
    toast({
      title: "New Order",
      description: "Started a new order",
    });
  };

  const handleQRMenuOrders = () => {
    toast({
      title: "QR Menu Orders",
      description: "QR menu order feature coming soon",
    });
  };

  const handleTableOrder = () => {
    toast({
      title: "Table Order",
      description: "Table order management feature coming soon",
    });
  };

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Reset scroll position when filters change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedCategory, searchQuery, minPrice, maxPrice, stockFilter]);

  const { subscriptionDiscountAmount, total: orderGrandTotal } = computeCurrentTotals();

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-auto md:h-16 border-b border-border bg-background px-3 sm:px-4 md:px-6 py-2 md:py-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-0 flex-shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0 max-w-2xl">
            <div className="flex items-center gap-2 shrink-0">
              <h1 className="text-base sm:text-lg md:text-xl font-semibold whitespace-nowrap">Point of Sale (POS)</h1>
              {isScannerEnabled && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Scan className="w-3 h-3" />
                  Scanner Active
                </Badge>
              )}
            </div>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search Product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 sm:pl-9 w-full md:max-w-md text-sm sm:text-base"
                data-testid="input-search-products"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isDesktop && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 sm:h-10 sm:w-10 relative" 
                onClick={() => setOrderPanelOpen(true)}
                data-testid="button-toggle-order-panel"
              >
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                {orderItems.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                    {orderItems.reduce((sum, item) => sum + item.quantity, 0)}
                  </Badge>
                )}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" data-testid="button-notifications">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <div className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 border-b border-border bg-background flex-shrink-0">
            <div className="flex items-center gap-2 mb-3 sm:mb-4 overflow-x-auto pb-1">
              <Badge variant="secondary" className="text-xs sm:text-sm shrink-0">Dashboard</Badge>
              <span className="text-muted-foreground shrink-0">/</span>
              <span className="text-xs sm:text-sm shrink-0">POS</span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="whitespace-nowrap shrink-0 text-xs sm:text-sm h-7 sm:h-8"
                  data-testid="button-category-all"
                >
                  Show All
                </Button>
                <Button
                  variant={selectedCategory === "__none__" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory("__none__")}
                  className="whitespace-nowrap shrink-0 text-xs sm:text-sm h-7 sm:h-8"
                  data-testid="button-category-none"
                >
                  None
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className="whitespace-nowrap shrink-0 text-xs sm:text-sm h-7 sm:h-8"
                    data-testid={`button-category-${category.slug}`}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>

              {/* Advanced Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="shrink-0 text-xs sm:text-sm h-7 sm:h-8"
                >
                  <Filter className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Filters
                </Button>
                {(minPrice || maxPrice || stockFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMinPrice("");
                      setMaxPrice("");
                      setStockFilter("all");
                    }}
                    className="shrink-0 text-xs sm:text-sm h-7 sm:h-8"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Clear Filters
                  </Button>
                )}
                {allProducts.length > 0 && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {allProducts.length} of {totalProducts} products
                  </Badge>
                )}
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-muted/50 rounded-md border">
                  <div>
                    <Label className="text-xs">Min Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="h-7 sm:h-8 text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Max Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="h-7 sm:h-8 text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Stock Status</Label>
                    <Select value={stockFilter} onValueChange={setStockFilter}>
                      <SelectTrigger className="h-7 sm:h-8 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Products</SelectItem>
                        <SelectItem value="inStock">In Stock</SelectItem>
                        <SelectItem value="outOfStock">Out of Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 min-w-0"
          >
            {productsLoading && allProducts.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-square bg-muted rounded-lg mb-2 sm:mb-3" />
                    <div className="h-3 sm:h-4 bg-muted rounded w-3/4 mb-1 sm:mb-2" />
                    <div className="h-3 sm:h-4 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : allProducts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground px-4">
                <div className="text-center">
                  <p className="text-base sm:text-lg font-medium mb-1">No products found</p>
                  <p className="text-xs sm:text-sm">Try adjusting your search or filter</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                  {allProducts.map((product) => {
                    // Calculate available stock (quantity - sold)
                    const quantity = parseFloat(product.quantity || "0");
                    const sold = soldQuantities[product.id] || 0;
                    const availableStock = Math.max(0, quantity - sold);
                    
                    return (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAddToOrder={handleAddToOrder}
                        availableStock={availableStock}
                      />
                    );
                  })}
                </div>
                {/* Infinite scroll trigger */}
                <div ref={observerTarget} className="h-4 flex items-center justify-center py-4">
                  {isFetchingNextPage && (
                    <div className="text-sm text-muted-foreground">Loading more products...</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <OrderPanel
        orderItems={orderItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onUpdateItemDiscount={handleUpdateItemDiscount}
        onClearOrder={handleClearOrder}
        onSaveDraft={handleSaveDraft}
        onProcessPayment={handleProcessPayment}
        orderNumber={currentOrderNumber}
        selectedTable={selectedTable}
        onSelectTable={setSelectedTable}
        tables={tables}
        diningOption={diningOption}
        onChangeDiningOption={setDiningOption}
        searchInPacking={searchInPacking}
        onSearchInPacking={setSearchInPacking}
        manualDiscount={manualDiscount}
        onManualDiscountChange={setManualDiscount}
        discountType={discountType}
        onDiscountTypeChange={setDiscountType}
        onDiscountChange={handleDiscountChange}
        subscriptionDiscountAmount={subscriptionDiscountAmount}
        subscriptionCustomerLabel={appliedSubscription?.customerName ?? null}
        onClearSubscription={() => setAppliedSubscription(null)}
        open={isDesktop ? undefined : orderPanelOpen}
        onOpenChange={isDesktop ? undefined : setOrderPanelOpen}
      />

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onConfirm={handleConfirmPayment}
        total={orderGrandTotal}
        orderNumber={currentOrderNumber}
      />

      <DraftListModal
        open={draftListModalOpen}
        onClose={() => setDraftListModalOpen(false)}
        draftOrders={draftOrders}
        onEditDraft={handleEditDraft}
        onPrintDraft={handlePrintDraft}
        onDeleteDraft={handleDeleteDraft}
      />

      {receiptData && (
        <ReceiptPrintModal
          open={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          order={receiptData}
          onPrint={handlePrintReceipt}
        />
      )}

      {/* Size Selection Dialog for Products with Size Pricing */}
      <Dialog open={sizeSelectionDialogOpen} onOpenChange={setSizeSelectionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Size</DialogTitle>
            <DialogDescription>
              {pendingProduct?.name} - Please select a size/variant
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {pendingProduct && (() => {
              const sizePrices = pendingProduct.sizePrices as Record<string, string> | null | undefined;
              const sizes = sizePrices ? Object.keys(sizePrices) : [];
              // Calculate available stock (quantity - sold)
              const quantity = parseFloat(pendingProduct.quantity || "0");
              const sold = soldQuantities[pendingProduct.id] || 0;
              const availableStock = Math.max(0, quantity - sold);
              const isOutOfStock = availableStock <= 0;
              
              if (sizes.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground">
                    No sizes/variants configured for this product.
                  </p>
                );
              }
              
              return (
                <div className="space-y-3">
                  {/* Stock information */}
                  <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Available Stock:</span>
                    <Badge variant={isOutOfStock ? "destructive" : availableStock < 5 ? "secondary" : "default"}>
                      {availableStock.toFixed(2)} {pendingProduct.unit}
                    </Badge>
                  </div>
                  {isOutOfStock && (
                    <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive font-medium">
                        This product is out of stock and cannot be added to the order.
                      </p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-3">
                    {sizes.map((size) => {
                      const price = sizePrices?.[size] || pendingProduct.price;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => !isOutOfStock && setSelectedSize(size)}
                          disabled={isOutOfStock}
                          className={`p-4 border-2 rounded-lg transition-all ${
                            isOutOfStock
                              ? "opacity-50 cursor-not-allowed border-muted"
                              : selectedSize === size
                              ? "border-primary bg-primary/10"
                              : "border-muted hover:border-primary/50"
                          }`}
                          data-testid={`button-size-${size}`}
                        >
                          <div className="font-semibold text-lg">{size}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            ${parseFloat(price).toFixed(2)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSizeSelectionDialogOpen(false);
                setPendingProduct(null);
                setSelectedSize("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSizeSelection}
              disabled={!selectedSize || (pendingProduct && parseFloat(pendingProduct.quantity || "0") <= 0)}
              data-testid="button-confirm-size"
            >
              Add to Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
