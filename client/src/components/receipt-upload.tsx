import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileImage, Check, X, RotateCw, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { InsertFoodItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface ExtractedItem {
  name: string;
  quantity: number;
  unit: string;
  price: number | null;
  expiryDate: string;
}

interface ReceiptResponse {
  receiptUrl: string;
  message: string;
  items: ExtractedItem[];
  error?: string;
}

export function ReceiptUpload() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [receipt, setReceipt] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processingStage, setProcessingStage] = useState<"idle" | "uploading" | "processing" | "complete" | "error">("idle");
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<{[key: string]: boolean}>({});
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    setReceipt(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    setProcessingStage("idle");
    setProcessingError(null);
    setExtractedItems([]);
    setSelectedItems({});
  };

  const handleUpload = async () => {
    if (!receipt) {
      toast({
        title: "No file selected",
        description: "Please select a receipt image to upload",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      setProcessingStage("uploading");
      
      // Create form data for file upload
      const formData = new FormData();
      formData.append("receipt", receipt);

      // Upload receipt
      const response = await fetch("/api/receipts/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload receipt");
      }

      const data: ReceiptResponse = await response.json();
      
      setProcessingStage("processing");
      
      // Add a small delay to show the processing state to the user
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (data.error) {
        setProcessingStage("error");
        setProcessingError(data.error);
        toast({
          title: "Processing error",
          description: data.error,
          variant: "destructive",
        });
      } else if (data.items && data.items.length > 0) {
        setExtractedItems(data.items);
        
        // Initialize all items as selected
        const initialSelection = data.items.reduce((acc, _, index) => {
          acc[index.toString()] = true;
          return acc;
        }, {} as {[key: string]: boolean});
        
        setSelectedItems(initialSelection);
        setProcessingStage("complete");
        setOpenDialog(true);
        
        toast({
          title: "Receipt analyzed",
          description: `Found ${data.items.length} items on your receipt`,
        });
      } else {
        // No items found but not an error
        setProcessingStage("complete");
        toast({
          title: "Receipt uploaded",
          description: data.message || "No items could be extracted from this receipt",
        });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      setProcessingStage("error");
      setProcessingError(error.message || "Failed to process receipt");
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred while uploading the receipt",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const toggleSelectItem = (index: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleAddToInventory = async () => {
    try {
      setUploading(true);
      
      // Get locations to find default location
      const locationsResponse = await fetch('/api/locations');
      if (!locationsResponse.ok) {
        throw new Error('Failed to fetch locations');
      }
      const locations = await locationsResponse.json();
      
      let defaultLocationId: number | undefined;
      
      if (Array.isArray(locations) && locations.length > 0) {
        defaultLocationId = locations[0].id;
      } else {
        // If no location exists, create a default one
        const newLocationResponse = await fetch('/api/locations', {
          method: 'POST',
          body: JSON.stringify({
            name: 'My Kitchen',
            type: 'fridge'
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!newLocationResponse.ok) {
          throw new Error('Failed to create default location');
        }
        const newLocation = await newLocationResponse.json();
        defaultLocationId = newLocation.id;
      }
      
      // Filter selected items and add to inventory
      const itemsToAdd = Object.entries(selectedItems)
        .filter(([_, selected]) => selected)
        .map(([index]) => {
          const item = extractedItems[parseInt(index)];
          return {
            ...item,
            locationId: defaultLocationId,
            purchased: new Date().toISOString().split('T')[0]
          };
        });
      
      for (const item of itemsToAdd) {
        const response = await fetch('/api/food-items', {
          method: 'POST',
          body: JSON.stringify(item),
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error(`Failed to add item: ${item.name}`);
        }
      }
      
      toast({
        title: "Items added to inventory",
        description: `Added ${itemsToAdd.length} items to your food inventory`,
      });
      
      setOpenDialog(false);
      // Reset form
      setReceipt(null);
      setPreviewUrl(null);
      setProcessingStage("idle");
      setExtractedItems([]);
      setSelectedItems({});
    } catch (error: any) {
      console.error("Add to inventory error:", error);
      toast({
        title: "Failed to add items",
        description: error.message || "An error occurred while adding items to inventory",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileImage className="h-5 w-5 text-primary" />
          Receipt Scanner
        </CardTitle>
        <CardDescription>
          Upload your grocery receipt to automatically add items to your inventory
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="receipt">Receipt Image</Label>
          <Input
            id="receipt"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="cursor-pointer"
          />
        </div>

        {previewUrl && (
          <div className="mt-4 border rounded-md p-2 relative">
            <div className="aspect-video w-full relative rounded-md overflow-hidden">
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="object-contain w-full h-full"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`rounded-full w-6 h-6 flex items-center justify-center ${processingStage === "uploading" || processingStage === "processing" || processingStage === "complete" ? "bg-primary" : "bg-muted"}`}>
              {processingStage === "complete" ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : processingStage === "error" ? (
                <X className="h-4 w-4 text-destructive" />
              ) : processingStage === "uploading" ? (
                <RotateCw className="h-4 w-4 text-primary-foreground animate-spin" />
              ) : (
                <span className="text-xs font-medium text-muted-foreground">1</span>
              )}
            </div>
            <span className="text-sm font-medium">Upload Receipt</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`rounded-full w-6 h-6 flex items-center justify-center ${processingStage === "processing" || processingStage === "complete" ? "bg-primary" : "bg-muted"}`}>
              {processingStage === "complete" ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : processingStage === "error" ? (
                <X className="h-4 w-4 text-destructive" />
              ) : processingStage === "processing" ? (
                <RotateCw className="h-4 w-4 text-primary-foreground animate-spin" />
              ) : (
                <span className="text-xs font-medium text-muted-foreground">2</span>
              )}
            </div>
            <span className="text-sm font-medium">Process Items</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`rounded-full w-6 h-6 flex items-center justify-center ${processingStage === "complete" ? "bg-primary" : "bg-muted"}`}>
              {processingStage === "complete" ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : (
                <span className="text-xs font-medium text-muted-foreground">3</span>
              )}
            </div>
            <span className="text-sm font-medium">Add to Inventory</span>
          </div>
        </div>

        {processingError && (
          <div className="text-destructive text-sm bg-destructive/10 p-2 rounded">
            {processingError}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleUpload}
          disabled={!receipt || uploading || processingStage === "processing" || processingStage === "uploading"}
          className="w-full"
        >
          {uploading ? (
            <>
              <RotateCw className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Scan Receipt
            </>
          )}
        </Button>
      </CardFooter>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className={isMobile ? "w-[95vw] rounded-lg" : ""}>
          <DialogHeader>
            <DialogTitle>Items Found on Receipt</DialogTitle>
            <DialogDescription>
              Select the items you want to add to your inventory
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-auto p-1">
            <div className="space-y-4">
              {extractedItems.map((item, index) => (
                <div 
                  key={index}
                  className={`p-3 border rounded-lg flex justify-between items-center ${
                    selectedItems[index.toString()] ? 'border-primary bg-primary/5' : 'border-muted'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.quantity} {item.unit} · ${item.price ? (item.price / 100).toFixed(2) : '0.00'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Expires: {new Date(item.expiryDate || '').toLocaleDateString()}
                    </div>
                  </div>
                  
                  <Button 
                    variant={selectedItems[index.toString()] ? "default" : "outline"} 
                    size="sm"
                    onClick={() => toggleSelectItem(index.toString())}
                  >
                    {selectedItems[index.toString()] ? (
                      <Check className="h-4 w-4" />
                    ) : "Select"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddToInventory}
              disabled={uploading || Object.values(selectedItems).filter(selected => selected).length === 0}
            >
              {uploading ? (
                <>
                  <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  Add to Inventory
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}