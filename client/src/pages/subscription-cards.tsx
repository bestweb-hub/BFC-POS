import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CustomerSelect } from "@/components/customer-select";
import type { SubscriptionCard, Customer } from "@shared/schema";
import { CreditCard, Ban, Copy } from "lucide-react";

type CardRow = SubscriptionCard & { customer: Customer };

export default function SubscriptionCardsPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("subscription_cards.manage");

  const [issueOpen, setIssueOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [overrideValue, setOverrideValue] = useState("");
  const [notes, setNotes] = useState("");

  const { data: cards = [], isLoading } = useQuery<CardRow[]>({
    queryKey: ["/api/subscription-cards"],
    enabled: canManage,
    queryFn: async () => {
      const res = await fetch("/api/subscription-cards", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load subscription cards");
      return res.json();
    },
  });

  const { data: eligibility, isFetching: eligibilityLoading } = useQuery({
    queryKey: ["/api/customers", selectedCustomerId, "subscription-eligibility"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${selectedCustomerId}/subscription-eligibility`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load eligibility");
      return res.json() as Promise<{
        eligible: boolean;
        lifetimePosSpend: number;
        minSpend: number;
      }>;
    },
    enabled: canManage && !!selectedCustomerId,
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { customerId: selectedCustomerId };
      if (overrideValue.trim()) body.discountOverrideValue = overrideValue.trim();
      if (notes.trim()) body.notes = notes.trim();
      const res = await apiRequest("POST", "/api/subscription-cards", body);
      return res.json() as Promise<SubscriptionCard>;
    },
    onSuccess: (card) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-cards"] });
      setIssueOpen(false);
      setSelectedCustomerId("");
      setOverrideValue("");
      setNotes("");
      toast({
        title: "Card issued",
        description: `Barcode: ${card.barcode}`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "Could not issue card", description: e.message, variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/subscription-cards/${id}`, { isActive: "false" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-cards"] });
      toast({ title: "Card deactivated" });
    },
    onError: (e: Error) => {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    },
  });

  const copyBarcode = (code: string) => {
    navigator.clipboard.writeText(code).then(
      () => toast({ title: "Copied", description: "Barcode copied to clipboard" }),
      () => toast({ title: "Copy failed", variant: "destructive" })
    );
  };

  if (!canManage) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">You do not have permission to manage subscription cards.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subscription cards</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customers who have spent at least the minimum on POS orders can receive a barcode card for loyalty
            discounts at checkout.
          </p>
        </div>
        <Button onClick={() => setIssueOpen(true)} className="shrink-0 gap-2">
          <CreditCard className="h-4 w-4" />
          Issue card
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active & past cards</CardTitle>
          <CardDescription>Scan the barcode on the POS screen (with the product scanner enabled) to apply the discount.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscription cards yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs max-w-[200px] break-all">
                      {row.barcode}
                    </TableCell>
                    <TableCell>{row.customer.name}</TableCell>
                    <TableCell>
                      <Badge variant={row.isActive === "true" ? "default" : "secondary"}>
                        {row.isActive === "true" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyBarcode(row.barcode)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      {row.isActive === "true" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => deactivateMutation.mutate(row.id)}
                          disabled={deactivateMutation.isPending}
                        >
                          <Ban className="h-3 w-3 mr-1" />
                          Deactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue subscription card</DialogTitle>
            <DialogDescription>
              Eligibility is based on completed POS sales tied to the customer. Configure minimum spend and discount
              under Settings → Payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Customer</Label>
              <CustomerSelect value={selectedCustomerId} onValueChange={setSelectedCustomerId} />
            </div>
            {selectedCustomerId && (
              <div className="rounded-md border p-3 text-sm">
                {eligibilityLoading ? (
                  <span className="text-muted-foreground">Checking eligibility…</span>
                ) : eligibility ? (
                  <>
                    <p>
                      <span className="text-muted-foreground">Lifetime POS spend: </span>
                      <strong>${eligibility.lifetimePosSpend.toFixed(2)}</strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Required: </span>
                      <strong>${eligibility.minSpend.toFixed(2)}</strong>
                    </p>
                    <Badge className="mt-2" variant={eligibility.eligible ? "default" : "destructive"}>
                      {eligibility.eligible ? "Eligible for a card" : "Not eligible yet"}
                    </Badge>
                  </>
                ) : null}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="sub-override">Discount override (optional)</Label>
              <Input
                id="sub-override"
                placeholder="Leave empty to use program default"
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Uses the same unit as the program: percent or fixed amount (see Settings).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-notes">Notes (optional)</Label>
              <Input id="sub-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => issueMutation.mutate()}
              disabled={
                !selectedCustomerId || !eligibility?.eligible || issueMutation.isPending || eligibilityLoading
              }
            >
              Issue card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
