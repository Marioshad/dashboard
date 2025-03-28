import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, FileIcon, BuildingIcon, CalendarIcon, CreditCardIcon, ReceiptIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";
import { Receipt, Store } from "@shared/schema";

interface ReceiptDetailProps {
  params: {
    id: string;
  };
}

export function ReceiptDetailPage({ params }: ReceiptDetailProps) {
  const { id } = params;
  const receiptId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Fetch receipt details
  const { data: receipt, isLoading: isLoadingReceipt, error: receiptError } = useQuery<Receipt>({
    queryKey: ['/api/receipts', receiptId],
    enabled: !isNaN(receiptId),
  });

  // Fetch store if available
  const { data: store } = useQuery<Store>({
    queryKey: ['/api/stores', receipt?.storeId],
    enabled: !!receipt?.storeId,
  });

  // Fetch food items from this receipt
  const { data: foodItems = [] } = useQuery<any[]>({
    queryKey: ['/api/foodItems', { receiptId }],
    enabled: !isNaN(receiptId),
  });

  useEffect(() => {
    if (receiptError) {
      toast({
        title: "Error loading receipt",
        description: "Failed to load receipt details. Please try again.",
        variant: "destructive",
      });
    }
  }, [receiptError, toast]);

  if (isLoadingReceipt) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">Loading Receipt...</h1>
          </div>
          
          <div className="grid gap-4">
            <Card className="animate-pulse">
              <CardHeader>
                <div className="h-7 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-96 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!receipt) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">Receipt Not Found</h1>
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => navigate("/receipts")}
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Receipts
            </Button>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <p>The receipt you are looking for could not be found.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const extractedData = receipt.extractedData ? JSON.parse(JSON.stringify(receipt.extractedData)) : null;
  
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Receipt {receipt.receiptNumber || `#${receipt.id}`}
            </h1>
            <p className="text-muted-foreground">
              Uploaded on {new Date(receipt.uploadDate).toLocaleString()}
            </p>
          </div>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => navigate("/receipts")}
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Receipts
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Receipt Image Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Receipt Image</CardTitle>
              <CardDescription>
                {receipt.fileName} ({Math.round(receipt.fileSize / 1024)} KB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative bg-gray-100 rounded-md overflow-hidden">
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-pulse flex flex-col items-center">
                      <ReceiptIcon className="h-10 w-10 text-gray-400" />
                      <p className="text-sm text-gray-500 mt-2">Loading receipt image...</p>
                    </div>
                  </div>
                )}
                <img 
                  src={receipt.filePath} 
                  alt="Receipt" 
                  className={`w-full h-auto object-contain max-h-[600px] ${imageLoaded ? '' : 'opacity-0'}`}
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Receipt Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Receipt Details</CardTitle>
              <CardDescription>
                Information extracted from the receipt
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Store Information */}
                {(store || (extractedData?.store)) && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <BuildingIcon className="h-4 w-4 text-primary" />
                      <h3 className="font-medium">Store</h3>
                    </div>
                    <div className="pl-6 space-y-1 text-sm">
                      <p className="font-medium">{store?.name || extractedData?.store?.name || 'Unknown Store'}</p>
                      <p>{store?.location || extractedData?.store?.location}</p>
                      {(store?.phone || extractedData?.store?.phone) && (
                        <p>Phone: {store?.phone || extractedData?.store?.phone}</p>
                      )}
                      {(store?.vatNumber || extractedData?.store?.vatNumber) && (
                        <p>VAT: {store?.vatNumber || extractedData?.store?.vatNumber}</p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Receipt Transaction Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ReceiptIcon className="h-4 w-4 text-primary" />
                    <h3 className="font-medium">Transaction</h3>
                  </div>
                  <div className="pl-6 space-y-1 text-sm">
                    {receipt.receiptNumber && (
                      <p>Receipt #: {receipt.receiptNumber}</p>
                    )}
                    {receipt.receiptDate && (
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-3 w-3 text-gray-500" />
                        <span>{new Date(receipt.receiptDate).toLocaleString()}</span>
                      </div>
                    )}
                    {receipt.totalAmount && (
                      <div className="flex items-center gap-2">
                        <CreditCardIcon className="h-3 w-3 text-gray-500" />
                        <span>Total: {formatPrice(Number(receipt.totalAmount))}</span>
                      </div>
                    )}
                    {extractedData?.receiptDetails?.paymentMethod && (
                      <p>Payment: {extractedData.receiptDetails.paymentMethod}</p>
                    )}
                  </div>
                </div>
                
                {/* Items Summary */}
                {foodItems && foodItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileIcon className="h-4 w-4 text-primary" />
                      <h3 className="font-medium">Items</h3>
                    </div>
                    <div className="pl-6">
                      <p className="text-sm">{foodItems.length} items added to inventory</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Items Card */}
          {foodItems && foodItems.length > 0 && (
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Items from Receipt</CardTitle>
                <CardDescription>
                  Items added to your inventory from this receipt
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Location
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Expiry Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {foodItems.map((item: any) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.price ? formatPrice(item.price / 100) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.location?.name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(item.expiryDate).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}