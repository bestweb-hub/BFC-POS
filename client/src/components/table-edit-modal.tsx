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
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTableSchema, type Table } from "@shared/schema";
import type { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface TableEditModalProps {
  open: boolean;
  onClose: () => void;
  table: Table | null;
}

export function TableEditModal({ open, onClose, table }: TableEditModalProps) {
  const { toast } = useToast();

  const tableForm = useForm<z.infer<typeof insertTableSchema>>({
    resolver: zodResolver(insertTableSchema),
    defaultValues: {
      tableNumber: "",
      capacity: "",
      description: "",
      status: "available",
    },
  });

  useEffect(() => {
    if (table) {
      tableForm.reset({
        tableNumber: table.tableNumber,
        capacity: table.capacity || "",
        description: table.description || "",
        status: table.status,
      });
    }
  }, [table, tableForm]);

  const updateTableMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertTableSchema>) => {
      if (!table) return;
      return await apiRequest("PATCH", `/api/tables/${table.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Success",
        description: "Table updated successfully",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update table",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: z.infer<typeof insertTableSchema>) => {
    updateTableMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="dialog-edit-table">
        <DialogHeader>
          <DialogTitle>Edit Table</DialogTitle>
          <DialogDescription>
            Update table information
          </DialogDescription>
        </DialogHeader>
        <Form {...tableForm}>
          <form onSubmit={tableForm.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={tableForm.control}
              name="tableNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Table Number/Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., 1, A1, VIP-1" data-testid="input-table-number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={tableForm.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="e.g., 4, 6, 8" data-testid="input-capacity" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={tableForm.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      value={field.value || ""}
                      placeholder="e.g., Window seat, Outdoor patio, Private room" 
                      data-testid="input-description"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={tableForm.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} data-testid="select-status">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="occupied">Occupied</SelectItem>
                      <SelectItem value="booked">Booked</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={updateTableMutation.isPending} data-testid="button-submit">
                Update Table
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
