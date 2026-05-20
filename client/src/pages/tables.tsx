import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTableSchema, type Table as TableType, type Product } from "@shared/schema";
import type { z } from "zod";
import { Plus, Edit, Trash2, Eye, Printer, Users, ShoppingCart, CheckCircle, PlusCircle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Tables() {
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [addItemsDialogOpen, setAddItemsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableType | null>(null);
  const [viewingTable, setViewingTable] = useState<TableType | null>(null);
  const [selectedTableForItems, setSelectedTableForItems] = useState<TableType | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: tables = [] } = useQuery<TableType[]>({
    queryKey: ["/api/tables"],
  });

  const filteredTables = tables.filter((table) => {
    const matchesSearch = !searchTerm || 
      table.tableNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (table.description && table.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || table.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const tableForm = useForm<z.infer<typeof insertTableSchema>>({
    resolver: zodResolver(insertTableSchema),
    defaultValues: {
      tableNumber: "",
      capacity: "",
      description: "",
      status: "available",
    },
  });

  const createTableMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertTableSchema>) => {
      return await apiRequest("POST", "/api/tables", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      setTableDialogOpen(false);
      tableForm.reset();
      toast({
        title: "Success",
        description: "Table created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create table",
        variant: "destructive",
      });
    },
  });

  const updateTableMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof insertTableSchema>> }) => {
      return await apiRequest("PATCH", `/api/tables/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      setTableDialogOpen(false);
      tableForm.reset();
      toast({
        title: "Success",
        description: "Table updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update table",
        variant: "destructive",
      });
    },
  });

  const deleteTableMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/tables/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Success",
        description: "Table deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete table",
        variant: "destructive",
      });
    },
  });

  const handleTableSubmit = (data: z.infer<typeof insertTableSchema>) => {
    if (editingTable) {
      updateTableMutation.mutate({ id: editingTable.id, data });
    } else {
      createTableMutation.mutate(data);
    }
  };

  const handleEditTable = (table: TableType) => {
    setEditingTable(table);
    tableForm.reset({
      tableNumber: table.tableNumber,
      capacity: table.capacity || "",
      description: table.description || "",
      status: table.status,
    });
    setTableDialogOpen(true);
  };

  const handleAddTableClick = () => {
    setEditingTable(null);
    tableForm.reset({
      tableNumber: "",
      capacity: "",
      description: "",
      status: "available",
    });
    setTableDialogOpen(true);
  };

  const handleViewTable = (table: TableType) => {
    setViewingTable(table);
    setViewDialogOpen(true);
  };

  const handleEditItems = async (table: TableType) => {
    try {
      const response = await fetch(`/api/tables/${table.id}/order`);
      const orderData = await response.json();
      
      if (orderData && orderData.id) {
        setLocation("/");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('loadDraft', { 
            detail: { orderId: orderData.id } 
          }));
        }, 100);
      } else {
        toast({
          title: "No Order Found",
          description: "This table has no active order",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load order",
        variant: "destructive",
      });
    }
  };

  const handleOpenAddItems = (table: TableType) => {
    setSelectedTableForItems(table);
    setSelectedProduct("");
    setQuantity("1");
    setAddItemsDialogOpen(true);
  };

  const addItemMutation = useMutation({
    mutationFn: async ({ orderId, productId, quantity }: { orderId: string; productId: string; quantity: number }) => {
      const product = products.find(p => p.id === productId);
      if (!product) throw new Error("Product not found");
      
      return await apiRequest("POST", `/api/orders/${orderId}/items`, {
        productId,
        quantity,
        price: product.price,
        total: (parseFloat(product.price) * quantity).toFixed(2),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setAddItemsDialogOpen(false);
      toast({
        title: "Success",
        description: "Item added to order successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive",
      });
    },
  });

  const handleAddItem = async () => {
    if (!selectedProduct) {
      toast({
        title: "Error",
        description: "Please select a product",
        variant: "destructive",
      });
      return;
    }

    if (!quantity || parseInt(quantity) < 1) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTableForItems) {
      toast({
        title: "Error",
        description: "No table selected",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/tables/${selectedTableForItems.id}/order`);
      const orderData = await response.json();
      
      if (orderData && orderData.id) {
        addItemMutation.mutate({
          orderId: orderData.id,
          productId: selectedProduct,
          quantity: parseInt(quantity),
        });
      } else {
        toast({
          title: "No Order Found",
          description: "This table has no active order",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive",
      });
    }
  };

  const handlePrintDirectly = async (table: TableType) => {
    await handlePrintTable(table);
  };

  const completeOrderMutation = useMutation({
    mutationFn: async ({ orderId, tableId }: { orderId: string; tableId: string }) => {
      await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status: "completed" });
      return await apiRequest("PATCH", `/api/tables/${tableId}/status`, { status: "available" });
    },
    onSuccess: () => {
      // Invalidate tables, orders, and sales
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      
      // Invalidate inventory queries
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
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
      
      toast({
        title: "Success",
        description: "Order completed and table is now available",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete order",
        variant: "destructive",
      });
    },
  });

  const handleCompleteOrder = async (table: TableType) => {
    try {
      const response = await fetch(`/api/tables/${table.id}/order`);
      const orderData = await response.json();
      
      if (orderData && orderData.id) {
        completeOrderMutation.mutate({
          orderId: orderData.id,
          tableId: table.id,
        });
      } else {
        toast({
          title: "No Order Found",
          description: "This table has no active order",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete order",
        variant: "destructive",
      });
    }
  };

  const handlePrintTable = async (table: TableType) => {
    try {
      const response = await fetch(`/api/tables/${table.id}/order`);
      const orderData = await response.json();

      let orderItemsSection = '';
      let orderSummarySection = '';

      if (orderData && orderData.items && orderData.items.length > 0) {
        const itemsRows = orderData.items.map((item: any) => `
          <tr>
            <td>${item.productName}</td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">$${item.price}</td>
            <td style="text-align: center;">-</td>
            <td style="text-align: right;">$${item.total}</td>
          </tr>
        `).join('');

        const totalUSD = parseFloat(orderData.total);
        const totalKHR = (totalUSD * 4100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        orderItemsSection = `
          <h3>Order Items</h3>
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th class="text-center">Quantity</th>
                <th class="text-right">Price</th>
                <th class="text-center">Discount</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
        `;

        orderSummarySection = `
          <div class="summary">
            <p><strong>Subtotal:</strong> $${orderData.subtotal}</p>
            <p><strong>Discount:</strong> $${orderData.discount}</p>
            <p class="total"><strong>Total:</strong> $${orderData.total}</p>
            <p class="total-khr"><strong>Total in KHR:</strong> ៛${totalKHR}</p>
            <hr>
            <p><strong>Pay by:</strong> ${orderData.paymentMethod || "N/A"}</p>
            <p><strong>Payment Status:</strong> ${orderData.paymentStatus}</p>
          </div>
        `;
      }

      const printContent = `
        <html>
          <head>
            <title>Table Information - ${table.tableNumber}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
              h1 { color: #EA580C; margin-bottom: 20px; }
              h3 { margin-top: 20px; }
              .details { margin: 20px 0; }
              .details p { margin: 8px 0; }
              .label { font-weight: bold; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f3f4f6; font-weight: 600; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .summary { margin-top: 20px; text-align: right; }
              .summary p { margin: 8px 0; }
              .total { font-weight: bold; font-size: 1.3em; color: #ea580c; }
              .total-khr { color: #666; font-size: 0.95em; margin-top: 4px; }
              hr { margin: 20px 0; border: none; border-top: 2px solid #e5e7eb; }
            </style>
          </head>
          <body>
            <h1>Table Information</h1>
            <div class="details">
              <p><span class="label">Table Number:</span> ${table.tableNumber}</p>
              <p><span class="label">Capacity:</span> ${table.capacity || 'Not specified'}</p>
              <p><span class="label">Description:</span> ${table.description || 'No description'}</p>
              <p><span class="label">Status:</span> ${table.status}</p>
            </div>
            ${orderItemsSection}
            ${orderSummarySection}
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error("Error printing table:", error);
      toast({
        title: "Error",
        description: "Failed to print table information",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-6 border-b gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">Table Management</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your restaurant tables and seating arrangements</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          <div className="flex justify-end">
            <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAddTableClick} data-testid="button-add-table">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Table
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-md" data-testid="dialog-table">
                <DialogHeader>
                  <DialogTitle>{editingTable ? "Edit Table" : "Add New Table"}</DialogTitle>
                  <DialogDescription>
                    {editingTable ? "Update table information" : "Create a new table in your restaurant"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...tableForm}>
                  <form onSubmit={tableForm.handleSubmit(handleTableSubmit)} className="space-y-4">
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

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setTableDialogOpen(false)} data-testid="button-cancel">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createTableMutation.isPending || updateTableMutation.isPending} data-testid="button-submit">
                        {editingTable ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by table number or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table Number</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTables.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12">
                          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No tables found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTables.map((table) => (
                        <TableRow key={table.id} data-testid={`row-table-${table.id}`}>
                          <TableCell className="font-medium" data-testid={`text-table-number-${table.id}`}>
                            {table.tableNumber}
                          </TableCell>
                          <TableCell data-testid={`text-capacity-${table.id}`}>
                            {table.capacity || '-'}
                          </TableCell>
                          <TableCell data-testid={`text-description-${table.id}`}>
                            {table.description || '-'}
                          </TableCell>
                          <TableCell data-testid={`text-status-${table.id}`}>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              table.status === 'available' ? 'bg-green-100 text-green-800' :
                              table.status === 'occupied' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {table.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {table.status === 'occupied' ? (
                              <div className="flex gap-2 justify-center">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleEditItems(table)}
                                  data-testid={`button-edit-items-${table.id}`}
                                  title="Edit Items"
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleOpenAddItems(table)}
                                  data-testid={`button-add-items-${table.id}`}
                                  title="Add Items"
                                >
                                  <PlusCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handlePrintDirectly(table)}
                                  data-testid={`button-print-directly-${table.id}`}
                                  title="Print Directly"
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleCompleteOrder(table)}
                                  data-testid={`button-complete-order-${table.id}`}
                                  title="Complete Order"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-2 justify-center">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleViewTable(table)}
                                  data-testid={`button-view-${table.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleEditTable(table)}
                                  data-testid={`button-edit-${table.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handlePrintTable(table)}
                                  data-testid={`button-print-${table.id}`}
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deleteTableMutation.mutate(table.id)}
                                  data-testid={`button-delete-${table.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md" data-testid="dialog-view-table">
          <DialogHeader>
            <DialogTitle>Table Details</DialogTitle>
          </DialogHeader>
          {viewingTable && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Table Number</p>
                <p className="font-medium text-lg">{viewingTable.tableNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Capacity</p>
                <p className="font-medium">{viewingTable.capacity || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{viewingTable.description || 'No description provided'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  viewingTable.status === 'available' ? 'bg-green-100 text-green-800' :
                  viewingTable.status === 'occupied' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {viewingTable.status}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addItemsDialogOpen} onOpenChange={setAddItemsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md" data-testid="dialog-add-items">
          <DialogHeader>
            <DialogTitle>Add Items to Order</DialogTitle>
            <DialogDescription>
              {selectedTableForItems && `Add items to Table ${selectedTableForItems.tableNumber}'s order`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Product</label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger data-testid="select-product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - ${product.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
                data-testid="input-quantity"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setAddItemsDialogOpen(false)}
              data-testid="button-cancel-add-items"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddItem}
              disabled={addItemMutation.isPending}
              data-testid="button-submit-add-items"
            >
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
