import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import type { Product } from "@shared/schema";

interface ProductSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  showPrice?: boolean;
  showUnit?: boolean;
  includeNoneOption?: boolean;
  noneOptionLabel?: string;
  className?: string;
  dataTestId?: string;
  /** Optional: when provided, use these products for the list. Ensures pre-selected product (e.g. from row click) is displayed. */
  products?: Product[];
  /** Optional: when true, shows loading state (e.g. when parent is fetching products). */
  isLoading?: boolean;
}

export function ProductSelect({
  value,
  onValueChange,
  placeholder = "Select a product",
  showPrice = false,
  showUnit = false,
  includeNoneOption = false,
  noneOptionLabel = "None",
  className,
  dataTestId,
  products: productsProp,
  isLoading: isLoadingProp,
}: ProductSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearchValue = useDebounce(searchValue, 300);
  const commandListRef = useRef<HTMLDivElement>(null);

  // Fetch products with debounced search (when products prop not provided)
  const { data: fetchedProducts = [], isLoading: isFetching } = useQuery<Product[]>({
    queryKey: ["/api/products", debouncedSearchValue],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearchValue) {
        params.append("search", debouncedSearchValue);
      }
      const response = await fetch(`/api/products?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      return Array.isArray(data) ? data : (data.products || []);
    },
    enabled: !productsProp,
  });
  const products = productsProp ?? fetchedProducts;
  const isLoading = isLoadingProp ?? (!productsProp && isFetching);
  const selectedProduct = products.find((p) => p.id === value);

  // Reset scroll when search value changes or popover opens
  useEffect(() => {
    if (open && commandListRef.current) {
      requestAnimationFrame(() => {
        if (commandListRef.current) {
          commandListRef.current.scrollTop = 0;
        }
      });
    }
  }, [debouncedSearchValue, open]);

  const getProductLabel = (product: Product) => {
    let label = product.name;
    if (showPrice) {
      label += ` - $${product.price}`;
    }
    if (showUnit && product.unit) {
      label += ` (${product.unit})`;
    }
    return label;
  };

  return (
    <Popover open={open} onOpenChange={(open) => {
      setOpen(open);
      if (open) {
        setSearchValue("");
        setTimeout(() => {
          if (commandListRef.current) {
            commandListRef.current.scrollTop = 0;
          }
        }, 10);
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={isLoading}
          className={cn("w-full justify-between min-w-0 font-normal", className)}
          data-testid={dataTestId}
        >
          <span className="truncate text-left flex-1 min-w-0">
            {isLoading
              ? "Loading products..."
              : selectedProduct
              ? getProductLabel(selectedProduct)
              : includeNoneOption && value === "none"
              ? noneOptionLabel
              : placeholder}
          </span>
          {isLoading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popper-anchor-width)] min-w-[280px] max-w-[400px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search products..."
            value={searchValue}
            onValueChange={(value) => {
              setSearchValue(value);
              if (commandListRef.current) {
                setTimeout(() => {
                  if (commandListRef.current) {
                    commandListRef.current.scrollTop = 0;
                  }
                }, 0);
              }
            }}
          />
          <CommandList ref={commandListRef}>
            <CommandEmpty>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading products...</span>
                </div>
              ) : (
                "No products found."
              )}
            </CommandEmpty>
            <CommandGroup heading="Products">
              {includeNoneOption && (
                <CommandItem
                  value={noneOptionLabel}
                  onSelect={() => {
                    onValueChange("none");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === "none" ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {noneOptionLabel}
                </CommandItem>
              )}
              {products
                .filter((product) => {
                  if (!debouncedSearchValue) return true;
                  const searchLower = debouncedSearchValue.toLowerCase();
                  return (
                    product.name.toLowerCase().includes(searchLower) ||
                    (product.unit && product.unit.toLowerCase().includes(searchLower))
                  );
                })
                .map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name}
                  onSelect={() => {
                    onValueChange(product.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === product.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{product.name}</span>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {showPrice && <span>${product.price}</span>}
                      {showUnit && product.unit && <span>{product.unit}</span>}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
