import { useQuery } from "@tanstack/react-query";
import { useBranch } from "@/contexts/BranchContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import type { Branch } from "@shared/schema";

export function BranchSelector() {
  const { selectedBranchId, setSelectedBranchId } = useBranch();
  
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const activeBranches = branches.filter(b => b.isActive === "true");

  return (
    <Select
      value={selectedBranchId || "all"}
      onValueChange={(value) => setSelectedBranchId(value === "all" ? null : value)}
    >
      <SelectTrigger 
        className="w-[200px] bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30" 
        data-testid="select-branch"
      >
        <Building2 className="w-4 h-4 mr-2" />
        <SelectValue placeholder="All Branches" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" data-testid="option-all-branches">All Branches</SelectItem>
        {activeBranches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id} data-testid={`option-branch-${branch.id}`}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
