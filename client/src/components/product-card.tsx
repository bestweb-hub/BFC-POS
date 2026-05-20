import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Utensils } from "lucide-react";
import type { Product } from "@shared/schema";

interface ProductCardProps {
  product: Product & { categoryName?: string };
  onAddToOrder: (product: Product) => void;
  availableStock?: number; // Available stock (quantity - sold), if not provided, falls back to quantity
}

export function ProductCard({ product, onAddToOrder, availableStock }: ProductCardProps) {
  // Use availableStock if provided, otherwise fall back to quantity for backward compatibility
  const stock = availableStock !== undefined 
    ? availableStock 
    : parseFloat(product.quantity || "0");
  const isOutOfStock = stock <= 0;
  
  return (
    <Card
      className={`overflow-hidden transition-all ${
        isOutOfStock 
          ? "opacity-60 cursor-not-allowed" 
          : "hover-elevate active-elevate-2 cursor-pointer"
      }`}
      onClick={() => !isOutOfStock && onAddToOrder(product)}
      data-testid={`card-product-${product.id}`}
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-accent">
            <Utensils className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute bottom-2 right-2">
          {isOutOfStock ? (
            <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center shadow-lg">
              <span className="text-[10px] font-bold text-destructive-foreground">0</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <Plus className="w-4 h-4 text-primary-foreground" />
            </div>
          )}
        </div>
        {/* Stock badge */}
        <div className="absolute top-2 left-2">
          <Badge 
            variant={isOutOfStock ? "destructive" : stock < 5 ? "secondary" : "default"}
            className="text-[10px] px-1.5 py-0.5 font-semibold"
          >
            Stock: {stock.toFixed(2)} {product.unit}
          </Badge>
        </div>
      </div>
      <div className="p-2 sm:p-3 min-h-[60px] sm:min-h-[70px] flex flex-col justify-between">
        <h3 className="font-medium text-xs sm:text-sm mb-1 line-clamp-2 break-words leading-tight" data-testid={`text-product-name-${product.id}`}>
          {product.name}
        </h3>
        {/* Show size badges for products with size pricing (any unit type); hide single price when size-priced */}
        {product.sizePrices && (() => {
          const sizePrices = product.sizePrices as Record<string, string> | null | undefined;
          if (sizePrices && Object.keys(sizePrices).length > 0) {
            const sizes = Object.keys(sizePrices);
            return (
              <div className="flex flex-wrap gap-1 mb-1">
                {sizes.slice(0, 3).map((size) => (
                  <Badge key={size} variant="secondary" className="text-[10px] px-1 py-0">
                    {size}
                  </Badge>
                ))}
                {sizes.length > 3 && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    +{sizes.length - 3}
                  </Badge>
                )}
              </div>
            );
          }
          return null;
        })()}
        <div className="flex items-center justify-between mt-auto">
          {(!product.sizePrices || Object.keys((product.sizePrices as Record<string, string>) || {}).length === 0) && (
            <p className="text-sm sm:text-base font-semibold text-primary font-mono" data-testid={`text-product-price-${product.id}`}>
              ${parseFloat(product.price).toFixed(2)}
            </p>
          )}
          {isOutOfStock && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Out of Stock
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
