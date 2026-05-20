import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBranchSchema, type InsertBranch, type Branch } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Plus, Pencil, Trash2, Building2, MapPin, Phone, User } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function BranchesPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertBranch) => apiRequest("POST", "/api/branches", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setIsAddDialogOpen(false);
      toast({ title: "Success", description: "Branch created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create branch", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertBranch> }) =>
      apiRequest("PATCH", `/api/branches/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setIsEditDialogOpen(false);
      setSelectedBranch(null);
      toast({ title: "Success", description: "Branch updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update branch", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({ title: "Success", description: "Branch deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete branch", variant: "destructive" });
    },
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none border-b px-4 md:px-6 py-3 md:py-4 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Branch Management</h1>
            <p className="text-blue-100 text-xs md:text-sm">Manage multiple store locations</p>
          </div>
          {hasPermission("branches.create") && (
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-white text-blue-600 hover:bg-blue-50 w-full sm:w-auto"
              data-testid="button-add-branch"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Branch
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <div className="text-center py-12">Loading branches...</div>
        ) : branches.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>No branches yet. Create your first branch to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((branch) => (
              <Card key={branch.id} data-testid={`card-branch-${branch.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">{branch.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      {hasPermission("branches.edit") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setSelectedBranch(branch);
                            setIsEditDialogOpen(true);
                          }}
                          data-testid={`button-edit-${branch.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {hasPermission("branches.delete") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(branch.id)}
                          data-testid={`button-delete-${branch.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {branch.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{branch.location}</span>
                    </div>
                  )}
                  {branch.contactPerson && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{branch.contactPerson}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm pt-2">
                    <span className="text-muted-foreground">Status:</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        branch.isActive === "true" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {branch.isActive === "true" ? "Active" : "Inactive"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BranchDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />

      <BranchDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setSelectedBranch(null);
        }}
        onSubmit={(data) => selectedBranch && updateMutation.mutate({ id: selectedBranch.id, data })}
        isPending={updateMutation.isPending}
        initialData={selectedBranch || undefined}
        isEdit
      />
    </div>
  );
}

interface BranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertBranch) => void;
  isPending: boolean;
  initialData?: Branch;
  isEdit?: boolean;
}

function BranchDialog({ open, onOpenChange, onSubmit, isPending, initialData, isEdit }: BranchDialogProps) {
  const form = useForm<InsertBranch>({
    resolver: zodResolver(isEdit ? insertBranchSchema.partial({ password: true }) : insertBranchSchema),
    defaultValues: {
      name: "",
      username: "",
      password: "",
      location: "",
      contactPerson: "",
      phone: "",
      isActive: "true",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
        isActive: initialData.isActive === "true" ? "true" : "false",
        password: "",
      });
    } else {
      form.reset({
        name: "",
        username: "",
        password: "",
        location: "",
        contactPerson: "",
        phone: "",
        isActive: "true",
      });
    }
  }, [initialData, form]);

  const handleSubmit = (data: InsertBranch) => {
    if (isEdit && !data.password) {
      const { password, ...submitData } = data;
      onSubmit(submitData as InsertBranch);
    } else {
      onSubmit(data);
    }
    if (!isEdit) {
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-branch">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Branch" : "Add New Branch"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Downtown Store" data-testid="input-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., downtown_store" data-testid="input-username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password {isEdit ? "(Leave blank to keep current)" : "*"}</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" placeholder={isEdit ? "Enter new password" : "Enter password"} data-testid="input-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="e.g., 123 Main Street" data-testid="input-location" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Person</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="e.g., John Doe" data-testid="input-contact" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="e.g., +1 234 567 8900" data-testid="input-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <p className="text-sm text-muted-foreground">Enable or disable this branch</p>
                  </div>
                  <FormControl>
                    <Switch 
                      checked={field.value === "true"} 
                      onCheckedChange={(checked) => field.onChange(checked ? "true" : "false")} 
                      data-testid="switch-active" 
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit">
                {isPending ? "Saving..." : isEdit ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
