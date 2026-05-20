import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Settings } from "@shared/schema";
import { Printer, Save } from "lucide-react";

export default function HardwarePage() {
  const { toast } = useToast();
  
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const [formData, setFormData] = useState<Partial<Settings>>({});

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Settings>) => {
      return await apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "Hardware settings saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save hardware settings",
        variant: "destructive",
      });
    },
  });

  const updateField = (field: keyof Settings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Ensure barcodeScanDelay is properly converted to integer
    const dataToSave = {
      ...formData,
      barcodeScanDelay: formData.barcodeScanDelay ? parseInt(String(formData.barcodeScanDelay), 10) : undefined,
    };
    updateMutation.mutate(dataToSave);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading hardware settings...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Printer className="w-6 h-6 md:w-8 md:h-8" />
              Hardware Management
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Configure printers, barcode scanners, and other POS hardware devices
            </p>
          </div>
          <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-hardware">
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Printer Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Printer Configuration</CardTitle>
              <CardDescription>Configure receipt and kitchen printers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="receipt-printer">Receipt Printer</Label>
                <Select 
                  value={formData.receiptPrinter || "default"} 
                  onValueChange={(value) => updateField("receiptPrinter", value)}
                >
                  <SelectTrigger id="receipt-printer" className="mt-2" data-testid="select-receipt-printer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Printer</SelectItem>
                    <SelectItem value="epson-tm">Epson TM-T88</SelectItem>
                    <SelectItem value="star-tsp">Star TSP143</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="kitchen-printer">Kitchen Printer (KOT)</Label>
                <Select 
                  value={formData.kitchenPrinter || "none"} 
                  onValueChange={(value) => updateField("kitchenPrinter", value)}
                >
                  <SelectTrigger id="kitchen-printer" className="mt-2" data-testid="select-kitchen-printer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="epson-tm">Epson TM-T88</SelectItem>
                    <SelectItem value="star-tsp">Star TSP143</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="paper-size">Paper Size</Label>
                <Select 
                  value={formData.paperSize || "80mm"} 
                  onValueChange={(value) => updateField("paperSize", value)}
                >
                  <SelectTrigger id="paper-size" className="mt-2" data-testid="select-paper-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58mm">58mm</SelectItem>
                    <SelectItem value="80mm">80mm</SelectItem>
                    <SelectItem value="a4">A4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Button variant="outline" className="w-full" data-testid="button-test-printer">
                  <Printer className="w-4 h-4 mr-2" />
                  Test Print
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Barcode Scanner Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Barcode Scanner Configuration</CardTitle>
              <CardDescription>Configure barcode scanner device for POS</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Barcode Scanner</Label>
                  <p className="text-sm text-muted-foreground">Connect barcode scanner device to POS</p>
                </div>
                <Switch 
                  checked={formData.enableBarcodeScanner === "true"}
                  onCheckedChange={(checked) => updateField("enableBarcodeScanner", checked ? "true" : "false")}
                  data-testid="switch-barcode-scanner" 
                />
              </div>

              {formData.enableBarcodeScanner === "true" && (
                <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                  <div>
                    <Label htmlFor="scanner-type">Scanner Type</Label>
                    <Select 
                      value={formData.barcodeScannerType || "keyboard"} 
                      onValueChange={(value) => updateField("barcodeScannerType", value)}
                    >
                      <SelectTrigger id="scanner-type" className="mt-2">
                        <SelectValue placeholder="Select scanner type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keyboard">Keyboard Wedge (USB/PS2)</SelectItem>
                        <SelectItem value="usb">USB HID Scanner</SelectItem>
                        <SelectItem value="bluetooth">Bluetooth Scanner</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Most USB scanners work as keyboard wedge by default
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="scan-delay">Scan Delay (ms)</Label>
                    <Input
                      id="scan-delay"
                      type="number"
                      min="50"
                      max="1000"
                      step="50"
                      value={formData.barcodeScanDelay || 200}
                      onChange={(e) => updateField("barcodeScanDelay", parseInt(e.target.value) || 200)}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Time to wait before processing scan (default: 200ms)
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Beep Sound on Scan</Label>
                      <p className="text-sm text-muted-foreground">Play sound when barcode is scanned</p>
                    </div>
                    <Switch 
                      checked={formData.barcodeBeepSound === "true"}
                      onCheckedChange={(checked) => updateField("barcodeBeepSound", checked ? "true" : "false")}
                      data-testid="switch-scanner-beep" 
                    />
                  </div>

                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="text-xs font-medium mb-1">Scanner Setup Instructions:</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Connect scanner via USB or pair via Bluetooth</li>
                      <li>Most scanners work automatically as keyboard input</li>
                      <li>Scan a product barcode in POS to add it to cart</li>
                      <li>Ensure scanner is in "Keyboard Wedge" mode</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cash Drawer Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Drawer Configuration</CardTitle>
              <CardDescription>Configure cash drawer settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Cash Drawer</Label>
                  <p className="text-sm text-muted-foreground">Auto-open cash drawer on payment</p>
                </div>
                <Switch 
                  checked={formData.enableCashDrawer === "true"}
                  onCheckedChange={(checked) => updateField("enableCashDrawer", checked ? "true" : "false")}
                  data-testid="switch-cash-drawer" 
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


