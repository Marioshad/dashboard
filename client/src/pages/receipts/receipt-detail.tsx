import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { 
  ArrowLeft, 
  Calendar, 
  Store, 
  FileText, 
  Receipt, 
  User, 
  CreditCard, 
  DollarSign,
  Tag,
  ShoppingCart
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

// Format date for display
const formatDate = (dateString: string | null) => {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// Format currency
const formatCurrency = (amount: number | string | null | undefined) => {
  if (amount === null || amount === undefined) return 'N/A';
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(numAmount);
};

export default function ReceiptDetail({ params }: { params: { id: string } }) {
  const receiptId = parseInt(params.id);
  const [, setLocation] = useLocation();
  
  // Fetch receipt details
  const { data: receipt, isLoading: isReceiptLoading, error: receiptError } = useQuery({
    queryKey: ['/api/receipts', receiptId],
    queryFn: async () => {
      const response = await fetch(`/api/receipts/${receiptId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch receipt details');
      }
      return response.json();
    },
    enabled: !isNaN(receiptId)
  });
  
  // Fetch food items linked to this receipt
  const { data: foodItems, isLoading: isItemsLoading, error: itemsError } = useQuery({
    queryKey: ['/api/foodItems', 'receiptId', receiptId],
    queryFn: async () => {
      const response = await fetch(`/api/foodItems?receiptId=${receiptId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch food items');
      }
      return response.json();
    },
    enabled: !isNaN(receiptId)
  });
  
  // Handle back button
  const handleBack = () => {
    setLocation('/receipts');
  };
  
  // Determine if we have extracted receipt details
  const hasExtractedData = receipt?.extractedData && 
    (receipt.extractedData.receiptDetails || receipt.extractedData.store);
  
  const receiptDetails = hasExtractedData ? receipt.extractedData.receiptDetails : {};
  const storeInfo = hasExtractedData ? receipt.extractedData.store : {};
  
  // Loading state
  if (isReceiptLoading || !receipt) {
    return (
      <DashboardLayout>
        <div className="flex flex-col space-y-6 p-6">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-fit flex items-center space-x-2"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Receipts</span>
          </Button>
          
          <div className="space-y-6">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  // Error state
  if (receiptError) {
    return (
      <DashboardLayout>
        <div className="flex flex-col space-y-6 p-6">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-fit flex items-center space-x-2"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Receipts</span>
          </Button>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-red-100 p-3 mb-4">
                  <FileText className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium">Failed to load receipt details</h3>
                <p className="text-muted-foreground mt-1 mb-4">
                  There was an error retrieving the receipt information.
                </p>
                <Button onClick={handleBack}>
                  Return to Receipts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex flex-col space-y-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-fit flex items-center space-x-2"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Receipts</span>
          </Button>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">Receipt Details</h1>
              <p className="text-muted-foreground">
                {receipt.fileName}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <a 
                href={receipt.filePath} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>View Original</span>
                </Button>
              </a>
            </div>
          </div>
        </div>
        
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Receipt Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center">
                    <Receipt className="h-5 w-5 mr-2" />
                    Receipt Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Upload Date</dt>
                      <dd className="flex items-center mt-1">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        {formatDate(receipt.uploadDate)}
                      </dd>
                    </div>
                    
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Receipt Date</dt>
                      <dd className="flex items-center mt-1">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        {formatDate(receipt.receiptDate || receiptDetails?.date)}
                      </dd>
                    </div>
                    
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Receipt Number</dt>
                      <dd className="flex items-center mt-1">
                        <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                        {receipt.receiptNumber || receiptDetails?.receiptNumber || 'Not available'}
                      </dd>
                    </div>
                    
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Total Amount</dt>
                      <dd className="flex items-center mt-1">
                        <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                        {formatCurrency(receipt.totalAmount || receiptDetails?.totalAmount)}
                      </dd>
                    </div>
                    
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Payment Method</dt>
                      <dd className="flex items-center mt-1">
                        <CreditCard className="h-4 w-4 mr-2 text-muted-foreground" />
                        {receiptDetails?.paymentMethod || 'Not available'}
                      </dd>
                    </div>
                    
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Cashier</dt>
                      <dd className="flex items-center mt-1">
                        <User className="h-4 w-4 mr-2 text-muted-foreground" />
                        {receiptDetails?.cashier || 'Not available'}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
              
              {/* Store Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center">
                    <Store className="h-5 w-5 mr-2" />
                    Store Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {storeInfo ? (
                    <dl className="space-y-4">
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Store Name</dt>
                        <dd className="mt-1 font-medium">{storeInfo.name || 'Unknown Store'}</dd>
                      </div>
                      
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Location</dt>
                        <dd className="mt-1">{storeInfo.location || 'Unknown'}</dd>
                      </div>
                      
                      {storeInfo.phone && (
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Phone</dt>
                          <dd className="mt-1">{storeInfo.phone}</dd>
                        </div>
                      )}
                      
                      {storeInfo.vatNumber && (
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">VAT Number</dt>
                          <dd className="mt-1">{storeInfo.vatNumber}</dd>
                        </div>
                      )}
                      
                      {storeInfo.taxId && (
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Tax ID</dt>
                          <dd className="mt-1">{storeInfo.taxId}</dd>
                        </div>
                      )}
                      
                      {receipt.storeId && (
                        <div className="mt-4 pt-4 border-t">
                          <Link href={`/stores/${receipt.storeId}`}>
                            <Button variant="outline" size="sm">
                              View Store Details
                            </Button>
                          </Link>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground">
                      No store information available
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* VAT Breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    VAT/Tax Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {receiptDetails?.vatBreakdown && receiptDetails.vatBreakdown.length > 0 ? (
                    <div className="space-y-4">
                      <table className="w-full">
                        <thead>
                          <tr className="text-sm font-medium text-muted-foreground">
                            <th className="text-left pb-2">Rate</th>
                            <th className="text-right pb-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receiptDetails.vatBreakdown.map((vat: any, index: number) => (
                            <tr key={index}>
                              <td className="py-1">{vat.rate}%</td>
                              <td className="py-1 text-right">{formatCurrency(vat.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                      <Separator />
                      
                      <div className="flex justify-between font-medium">
                        <span>Total VAT/Tax:</span>
                        <span>
                          {formatCurrency(
                            receiptDetails.vatBreakdown.reduce(
                              (total: number, vat: any) => total + parseFloat(vat.amount || 0), 
                              0
                            )
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground">
                      No VAT/tax information available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="items" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Purchased Items
                </CardTitle>
                <CardDescription>
                  Items extracted from this receipt
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isItemsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center space-x-4 p-4 border rounded-md">
                        <Skeleton className="h-10 w-10" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                        <Skeleton className="h-8 w-24" />
                      </div>
                    ))}
                  </div>
                ) : itemsError ? (
                  <div className="p-4 border border-red-200 rounded-md bg-red-50 text-red-700">
                    Failed to load food items. Please try again later.
                  </div>
                ) : foodItems && foodItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b text-sm font-medium">
                          <th className="px-4 py-2 text-left">Item</th>
                          <th className="px-4 py-2 text-left">Quantity</th>
                          <th className="px-4 py-2 text-left">Unit</th>
                          <th className="px-4 py-2 text-left">Expiry Date</th>
                          <th className="px-4 py-2 text-right">Price</th>
                          <th className="px-4 py-2 text-left">Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {foodItems.map((item: any) => (
                          <tr key={item.id} className="border-b hover:bg-muted/50">
                            <td className="px-4 py-3">
                              <div className="font-medium">{item.name}</div>
                            </td>
                            <td className="px-4 py-3">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-3">
                              {item.unit}
                            </td>
                            <td className="px-4 py-3">
                              {new Date(item.expiryDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {item.price ? formatCurrency(item.price / 100) : 'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              {item.locationId ? (
                                <Badge variant="outline">
                                  {item.location?.name || `Location ${item.locationId}`}
                                </Badge>
                              ) : 'None'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <ShoppingCart className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium">No items found</h3>
                    <p className="text-muted-foreground mt-1 max-w-md">
                      There are no food items linked to this receipt. If you've just uploaded
                      this receipt, you may need to add the items manually.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}