import { createContext, useContext, ReactNode } from "react";

interface BranchContextType {
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

// Branches feature removed: single store only; selectedBranchId always null.
export function BranchProvider({ children }: { children: ReactNode }) {
  return (
    <BranchContext.Provider value={{ selectedBranchId: null, setSelectedBranchId: () => {} }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}
