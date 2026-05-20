import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShoppingCart, Plus, Minus, Utensils, CheckCircle, Search, RefreshCw } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import type { Product, Category } from "@shared/schema";

interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  selectedSize?: string;
  price: number;
  total: number;
}

function getProductPrice(product: Product, selectedSize?: string): number {
  if (selectedSize && product.sizePrices && typeof product.sizePrices === "object") {
    const sp = product.sizePrices as Record<string, string>;
    if (sp[selectedSize] != null) return parseFloat(sp[selectedSize]);
  }
  return parseFloat(String(product.price));
}

export default function OrderPage() {
  const [location] = useLocation();
  const basePath = location.startsWith("/menu") ? "/menu" : "/order";
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sizeModalProduct, setSizeModalProduct] = useState<Product | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerContactType, setCustomerContactType] = useState<string>("phone");
  const [paymentMethod, setPaymentMethod] = useState<"cash_on_delivery" | "due">("cash_on_delivery");
  const [orderSuccess, setOrderSuccess] = useState<{ orderNumber: string } | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery.trim().toLowerCase(), 300);

  const { toast } = useToast();

  // Document title for customer portal (tab/window label)
  useEffect(() => {
    const title = basePath === "/menu" ? "Menu" : "Order";
    document.title = title;
    return () => {
      document.title = "";
    };
  }, [basePath]);

  const { data: products = [], isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useQuery<Product[]>({
    queryKey: ["/api/public/products"],
    queryFn: async () => {
      const res = await fetch("/api/public/products", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/public/categories"],
    queryFn: async () => {
      const res = await fetch("/api/public/categories", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const submitOrderMutation = useMutation({
    mutationFn: async (payload: {
      customerName: string;
      customerPhone: string;
      customerContactType?: string;
      paymentMethod?: "cash_on_delivery" | "due";
      items: Array<{ productId: string; quantity: number; selectedSize?: string }>;
    }) => {
      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to place order");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOrderSuccess({ orderNumber: data.orderNumber });
      setCart([]);
      setCheckoutOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Order failed",
        description: error.message || "Could not place order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addToCart = (product: Product, selectedSize?: string) => {
    const price = getProductPrice(product, selectedSize);
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.productId === product.id && i.selectedSize === selectedSize
      );
      if (existing) {
        return prev.map((i) =>
          i === existing ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          product,
          quantity: 1,
          selectedSize,
          price,
          total: price,
        },
      ];
    });
    setSizeModalProduct(null);
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const item = prev[index];
      const newQty = Math.max(0, item.quantity + delta);
      if (newQty === 0) return prev.filter((_, i) => i !== index);
      return prev.map((i, idx) =>
        idx === index ? { ...i, quantity: newQty, total: newQty * i.price } : i
      );
    });
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.total, 0);
  const hasSizePrices = (p: Product) =>
    p.sizePrices && typeof p.sizePrices === "object" && Object.keys(p.sizePrices as object).length > 0;

  const handlePlaceOrder = () => {
    if (!customerName.trim() || !customerPhone.trim() || cart.length === 0) return;
    submitOrderMutation.mutate({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerContactType: customerContactType as "phone" | "whatsapp" | "telegram" | "facebook" | "other",
      paymentMethod,
      items: cart.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        ...(i.selectedSize && { selectedSize: i.selectedSize }),
      })),
    });
  };

  // Filter products by category and search (POS-style)
  const filteredProducts = products.filter((p) => {
    const matchCategory = !selectedCategoryId || p.categoryId === selectedCategoryId;
    const matchSearch = !debouncedSearch || p.name.toLowerCase().includes(debouncedSearch);
    return matchCategory && matchSearch;
  });

  const productsByCategory = categories.length
    ? selectedCategoryId
      ? (() => {
          const cat = categories.find((c) => c.id === selectedCategoryId);
          if (!cat) return [];
          return [{ category: cat, products: filteredProducts }];
        })
      : categories.map((cat) => ({
          category: cat,
          products: filteredProducts.filter((p) => p.categoryId === cat.id),
        })).filter((g) => g.products.length > 0)
    : [{ category: { id: "", name: "All", slug: "all" }, products: filteredProducts }];

  // Loading or error for products
  if (productsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground">Loading menu...</p>
      </div>
    );
  }
  if (productsError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="font-medium text-foreground mb-2">Could not load menu</p>
          <p className="text-sm text-muted-foreground mb-4">Please check your connection and try again.</p>
          <Button onClick={() => refetchProducts()} variant="default" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-background">
      {/* Minimal top bar - Menu / Order title */}
      <header className="sticky top-0 z-20 bg-white dark:bg-card border-b border-slate-200/80 dark:border-border shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between gap-3 max-w-4xl mx-auto">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">{basePath === "/menu" ? "Menu" : "Order"}</p>
          </div>
          {!orderSuccess && cartCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="relative gap-1.5 text-foreground"
              onClick={() => setCheckoutOpen(true)}
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="font-medium">{cartCount} items</span>
              <Badge className="ml-0.5 bg-primary text-primary-foreground">{cartCount}</Badge>
            </Button>
          )}
        </div>

        {/* Search + category pills - Foodpanda style */}
        {!orderSuccess && (
          <div className="px-4 pb-3 space-y-3 max-w-4xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search dishes or drinks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 rounded-full bg-slate-100 dark:bg-muted/50 border-0 focus-visible:ring-2"
              />
            </div>
            <div className="w-full -mx-4 px-4 overflow-x-auto overflow-y-hidden scrollbar-thin">
              <div className="flex gap-2 pb-1 flex-nowrap">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(null)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    selectedCategoryId === null
                      ? "bg-primary text-primary-foreground"
                      : "bg-slate-200/80 dark:bg-muted text-muted-foreground hover:bg-slate-300 dark:hover:bg-muted/80"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      selectedCategoryId === cat.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-200/80 dark:bg-muted text-muted-foreground hover:bg-slate-300 dark:hover:bg-muted/80"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {orderSuccess ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Order received</h2>
          <p className="text-muted-foreground mb-6">
            Your order <strong>#{orderSuccess.orderNumber}</strong> has been sent to the store.
          </p>
          <Button onClick={() => setOrderSuccess(null)}>Place another order</Button>
        </div>
      ) : (
        <>
          <main className="flex-1 px-4 py-4 max-w-4xl mx-auto w-full pb-28">
            {productsLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-muted-foreground">Loading menu...</p>
              </div>
            ) : productsByCategory.length === 0 || filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Utensils className="w-14 h-14 text-mlate-300 dark:text-muted-foreground/50 mb-4" />
                <p className="font-medium text-foreground">No items match</p>
                <p className="text-sm text-muted-foreground mt-1">Try another category or search</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-6 rounded-full"
                  onClick={() => {
                    setSelectedCategoryId(null);
                    setSearchQuery("");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                {productsByCategory.map(({ category, products: list }) => (
                  <section key={category.id}>
                    <h2 className="text-lg font-semibold text-foreground mb-3">{category.name}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {list.map((product) => {
                        const stock = parseFloat(String(product.quantity ?? 0));
                        const outOfStock = stock <= 0;
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => {
                              if (outOfStock) return;
                              if (hasSizePrices(product)) {
                                setSizeModalProduct(product);
                              } else {
                                addToCart(product);
                              }
                            }}
                            className={`text-left rounded-2xl overflow-hidden bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm transition-all ${
                              outOfStock ? "opacity-60 cursor-not-allowed" : "hover:shadow-md active:scale-[0.98]"
                            }`}
                          >
                            <div className="aspect-[4/3] bg-slate-100 dark:bg-muted/50 relative">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Utensils className="w-10 h-10 text-slate-300 dark:text-muted-foreground" />
                                </div>
                              )}
                              {!outOfStock && (
                                <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white dark:bg-card shadow flex items-center justify-center">
                                  <Plus className="w-4 h-4 text-primary" />
                                </div>
                              )}
                            </div>
                            <div className="p-3">
                              <p className="font-medium text-foreground line-clamp-2 text-sm leading-tight">
                                {product.name}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-primary">
                                {product.sizePrices &&
                                typeof product.sizePrices === "object" &&
                                Object.keys(product.sizePrices as object).length > 0
                                  ? `From $${getProductPrice(product).toFixed(2)}`
                                  : `$${parseFloat(String(product.price)).toFixed(2)}`}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </main>

          {/* Sticky bottom CTA - Foodpanda style; safe area for notched devices */}
          <div className="fixed bottom-0 left-0 right-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white dark:bg-card border-t border-slate-200 dark:border-border shadow-[0_-4px_12px_rgba(0,0,0,0.06)] max-w-4xl mx-auto">
            <Button
              className="w-full h-12 rounded-xl font-semibold text-base gap-2"
              size="lg"
              disabled={cart.length === 0}
              onClick={() => setCheckoutOpen(true)}
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.length === 0
                ? "Your cart is empty"
                : `View cart · ${cartCount} ${cartCount === 1 ? "item" : "items"} · $${cartTotal.toFixed(2)}`}
            </Button>
          </div>
        </>
      )}

      {/* Size selection modal */}
      <Dialog open={!!sizeModalProduct} onOpenChange={() => setSizeModalProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sizeModalProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {sizeModalProduct &&
              typeof sizeModalProduct.sizePrices === "object" &&
              Object.entries(sizeModalProduct.sizePrices as Record<string, string>).map(
                ([size, price]) => (
                  <Button
                    key={size}
                    variant="outline"
                    className="justify-between"
                    onClick={() => addToCart(sizeModalProduct!, size)}
                  >
                    <span>{size}</span>
                    <span>${parseFloat(price).toFixed(2)}</span>
                  </Button>
                )
              )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout modal */}
      <Dialog open={checkoutOpen} onOpenChange={(open) => { setCheckoutOpen(open); if (!open) submitOrderMutation.reset(); }}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
          </DialogHeader>
          {submitOrderMutation.isError && (
            <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-3">
              {submitOrderMutation.error?.message || "Something went wrong. Please try again."}
            </div>
          )}
          <ScrollArea className="flex-1 max-h-[40vh] pr-4">
            <ul className="space-y-2">
              {cart.map((item, idx) => (
                <li
                  key={`${item.productId}-${item.selectedSize ?? ""}`}
                  className="flex items-center justify-between gap-2 py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {item.product.name}
                      {item.selectedSize && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {item.selectedSize}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${item.price.toFixed(2)} × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(idx, -1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(idx, 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => removeFromCart(idx)}
                    >
                      Remove
                    </Button>
                  </div>
                  <p className="font-semibold w-14 text-right">${item.total.toFixed(2)}</p>
                </li>
              ))}
            </ul>
          </ScrollArea>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact via</Label>
              <Select value={customerContactType} onValueChange={setCustomerContactType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash_on_delivery")}
                  className={`rounded-xl border-2 p-3 text-left transition-colors ${
                    paymentMethod === "cash_on_delivery"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 dark:border-border hover:border-primary/50"
                  }`}
                >
                  <span className="font-medium block">Cash on delivery</span>
                  <span className="text-xs text-muted-foreground">Pay when you receive</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("due")}
                  className={`rounded-xl border-2 p-3 text-left transition-colors ${
                    paymentMethod === "due"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 dark:border-border hover:border-primary/50"
                  }`}
                >
                  <span className="font-medium block">Pay later</span>
                  <span className="text-xs text-muted-foreground">Due / pay when ready</span>
                </button>
              </div>
            </div>
            <div className="flex justify-between text-lg font-semibold pt-2">
              <span>Total</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              Back
            </Button>
            <Button
              onClick={handlePlaceOrder}
              disabled={
                !customerName.trim() ||
                !customerPhone.trim() ||
                submitOrderMutation.isPending
              }
            >
              {submitOrderMutation.isPending ? "Placing order..." : "Place order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
