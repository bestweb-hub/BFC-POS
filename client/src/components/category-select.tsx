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
import type { Category } from "@shared/schema";

interface CategorySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  dataTestId?: string;
}

export function CategorySelect({
  value,
  onValueChange,
  placeholder = "Select category",
  className,
  dataTestId,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearchValue = useDebounce(searchValue, 300);
  const commandListRef = useRef<HTMLDivElement>(null);

  // Fetch categories with debounced search
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories", debouncedSearchValue],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearchValue) {
        params.append("search", debouncedSearchValue);
      }
      const response = await fetch(`/api/categories?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const selectedCategory = categories.find((c) => c.id === value);

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
          {selectedCategory ? selectedCategory.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search categories..."
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
            <CommandEmpty>No categories found.</CommandEmpty>
            <CommandGroup heading="Categories">
              {categories
                .filter((category) => {
                  if (!debouncedSearchValue) return true;
                  const searchLower = debouncedSearchValue.toLowerCase();
                  return category.name.toLowerCase().includes(searchLower);
                })
                .map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.name}
                  onSelect={() => {
                    onValueChange(category.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === category.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {category.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
