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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import type { Customer } from "@shared/schema";

interface CustomerSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  includeNewOption?: boolean;
  newOptionLabel?: string;
  className?: string;
  dataTestId?: string;
  onNewCustomer?: () => void;
}

export function CustomerSelect({
  value,
  onValueChange,
  placeholder = "Select customer",
  includeNewOption = false,
  newOptionLabel = "+ Create New Customer",
  className,
  dataTestId,
  onNewCustomer,
}: CustomerSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearchValue = useDebounce(searchValue, 300);
  const commandListRef = useRef<HTMLDivElement>(null);

  // Fetch customers with debounced search
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", debouncedSearchValue],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearchValue) {
        params.append("search", debouncedSearchValue);
      }
      const response = await fetch(`/api/customers?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
  });

  const selectedCustomer = customers.find((c) => c.id === value);

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
          className={cn("justify-between", className)}
          data-testid={dataTestId}
        >
          {selectedCustomer
            ? `${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ""}`
            : includeNewOption && value === "new"
            ? newOptionLabel
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search customers..."
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
            <CommandEmpty>No customers found.</CommandEmpty>
            <CommandGroup heading="Customers">
              {includeNewOption && (
                <CommandItem
                  value={newOptionLabel}
                  onSelect={() => {
                    onValueChange("new");
                    setOpen(false);
                    if (onNewCustomer) {
                      onNewCustomer();
                    }
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === "new" ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {newOptionLabel}
                </CommandItem>
              )}
              {customers
                .filter((customer) => {
                  if (!debouncedSearchValue) return true;
                  const searchLower = debouncedSearchValue.toLowerCase();
                  return (
                    customer.name?.toLowerCase().includes(searchLower) ||
                    customer.phone?.toLowerCase().includes(searchLower) ||
                    customer.email?.toLowerCase().includes(searchLower)
                  );
                })
                .map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.name || ""}
                  onSelect={() => {
                    onValueChange(customer.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === customer.id ? "opacity-100" : "opacity-0"
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
  );
}
