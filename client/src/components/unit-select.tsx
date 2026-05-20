import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Unit } from "@shared/schema";

interface UnitSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  "data-testid"?: string;
}

export function UnitSelect({ value, onValueChange, placeholder = "Select unit", className, id, "data-testid": dataTestId }: UnitSelectProps) {
  const [showAddUnitDialog, setShowAddUnitDialog] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const { toast } = useToast();

  const { data: units = [], isLoading } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/units");
      return await response.json();
    },
  });

  const createUnitMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/units", { name, description: "" });
      return await response.json();
    },
    onSuccess: (newUnit) => {
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      setShowAddUnitDialog(false);
      setNewUnitName("");
      onValueChange(newUnit.name);
      toast({
        title: "Success",
        description: "Unit added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add unit",
        variant: "destructive",
      });
    },
  });

  const handleAddUnit = () => {
    if (!newUnitName.trim()) {
      toast({
        title: "Error",
        description: "Unit name is required",
        variant: "destructive",
      });
      return;
    }
    createUnitMutation.mutate(newUnitName.trim());
  };

  return (
    <>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger id={id} className={className} data-testid={dataTestId}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {isLoading ? (
              <SelectItem value="loading" disabled>Loading...</SelectItem>
            ) : units.length === 0 ? (
              <SelectItem value="no-units" disabled>No units available</SelectItem>
            ) : (
              units.map((unit) => (
                <SelectItem key={unit.id} value={unit.name} data-testid={`option-unit-${unit.name}`}>
                  {unit.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setShowAddUnitDialog(true)}
          title="Add new unit"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <Dialog open={showAddUnitDialog} onOpenChange={setShowAddUnitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Unit</DialogTitle>
            <DialogDescription>
              Create a new unit for measurements
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="unit-name">Unit Name *</Label>
              <Input
                id="unit-name"
                placeholder="e.g., Kg, ml, Piece"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddUnit();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddUnitDialog(false);
              setNewUnitName("");
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddUnit}
              disabled={createUnitMutation.isPending || !newUnitName.trim()}
            >
              {createUnitMutation.isPending ? "Adding..." : "Add Unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
