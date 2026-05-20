import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table as TableIcon, CheckCircle, XCircle, Wrench, Edit, Trash2 } from "lucide-react";
import type { Table } from "@shared/schema";
import { useState } from "react";
import { TableEditModal } from "./table-edit-modal";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TableOrderModalProps {
  open: boolean;
  onClose: () => void;
  tables: Table[];
}

export function TableOrderModal({
  open,
  onClose,
  tables,
}: TableOrderModalProps) {
  const { toast } = useToast();
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const availableTables = tables.filter((t) => t.status === "available");
  const occupiedTables = tables.filter((t) => t.status === "occupied" || t.status === "booked");
  const maintenanceTables = tables.filter((t) => t.status === "maintenance");

  const toggleTableSelection = (tableId: string) => {
    setSelectedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableId)) {
        newSet.delete(tableId);
      } else {
        newSet.add(tableId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedTables(new Set(tables.map(t => t.id)));
  };

  const clearSelection = () => {
    setSelectedTables(new Set());
  };

  const deleteMutation = useMutation({
    mutationFn: async (tableId: string) => {
      return await apiRequest("DELETE", `/api/tables/${tableId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Success",
        description: "Table deleted successfully",
      });
      setDeleteConfirmOpen(false);
      setTableToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete table",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (tableIds: string[]) => {
      const results = await Promise.allSettled(
        tableIds.map(id => apiRequest("DELETE", `/api/tables/${id}`))
      );
      
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        throw new Error(`Failed to delete ${failed} table(s)`);
      }
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Success",
        description: `${selectedTables.size} table(s) deleted successfully`,
      });
      setBulkDeleteConfirmOpen(false);
      setSelectedTables(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete selected tables",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (table: Table) => {
    setTableToDelete(table);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (tableToDelete) {
      deleteMutation.mutate(tableToDelete.id);
    }
  };

  const handleBulkDelete = () => {
    setBulkDeleteConfirmOpen(true);
  };

  const confirmBulkDelete = () => {
    const tableIds = Array.from(selectedTables);
    bulkDeleteMutation.mutate(tableIds);
  };

  const TableCard = ({ table, statusColor }: { table: Table; statusColor: string }) => {
    const isSelected = selectedTables.has(table.id);
    
    return (
      <Card className="p-4" data-testid={`card-table-${table.id}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleTableSelection(table.id)}
              data-testid={`checkbox-table-${table.id}`}
              className="mt-1"
            />
            <div className={`w-10 h-10 rounded-lg ${statusColor} flex items-center justify-center`}>
              <TableIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold">Table {table.tableNumber}</h4>
              {table.capacity && (
                <p className="text-sm text-muted-foreground">
                  Capacity: {table.capacity} people
                </p>
              )}
              {table.description && (
                <p className="text-sm text-muted-foreground mt-1">{table.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className="capitalize"
              data-testid={`badge-status-${table.id}`}
            >
              {table.status}
            </Badge>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setEditingTable(table)}
              data-testid={`button-edit-table-${table.id}`}
              title="Edit Table"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleDelete(table)}
              data-testid={`button-delete-table-${table.id}`}
              title="Delete Table"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl" data-testid="modal-table-order">
        <DialogHeader>
          <DialogTitle>Table Orders</DialogTitle>
          <DialogDescription>
            Manage table status and assignments - Total Tables: {tables.length}
            {selectedTables.size > 0 && ` | Selected: ${selectedTables.size}`}
          </DialogDescription>
        </DialogHeader>
        
        {tables.length > 0 && (
          <div className="flex gap-2 pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={selectedTables.size === tables.length}
              data-testid="button-select-all"
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              disabled={selectedTables.size === 0}
              data-testid="button-clear-selection"
            >
              Clear Selection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selectedTables.size === 0}
              data-testid="button-delete-selected"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedTables.size})
            </Button>
          </div>
        )}

        <ScrollArea className="max-h-[600px] pr-4">
          <div className="space-y-6">
            {/* Available Tables */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-lg">
                  Available ({availableTables.length})
                </h3>
              </div>
              {availableTables.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center bg-muted/50 rounded-lg">
                  No available tables
                </p>
              ) : (
                <div className="grid gap-3">
                  {availableTables.map((table) => (
                    <TableCard 
                      key={table.id} 
                      table={table} 
                      statusColor="bg-green-600" 
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Booked/Occupied Tables */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-lg">
                  Booked/Occupied ({occupiedTables.length})
                </h3>
              </div>
              {occupiedTables.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center bg-muted/50 rounded-lg">
                  No booked or occupied tables
                </p>
              ) : (
                <div className="grid gap-3">
                  {occupiedTables.map((table) => (
                    <TableCard 
                      key={table.id} 
                      table={table} 
                      statusColor="bg-red-600" 
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Maintenance Tables */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-lg">
                  Maintenance ({maintenanceTables.length})
                </h3>
              </div>
              {maintenanceTables.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center bg-muted/50 rounded-lg">
                  No tables under maintenance
                </p>
              ) : (
                <div className="grid gap-3">
                  {maintenanceTables.map((table) => (
                    <TableCard 
                      key={table.id} 
                      table={table} 
                      statusColor="bg-orange-600" 
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>

      <TableEditModal
        open={!!editingTable}
        onClose={() => setEditingTable(null)}
        table={editingTable}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Table</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Table {tableToDelete?.tableNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent data-testid="dialog-bulk-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Tables</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedTables.size} selected table(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
