import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  ShoppingBag, 
  Calendar, 
  Clock, 
  Receipt, 
  User, 
  CreditCard,
  DollarSign,
  Tag,
  CircleX,
  Loader2,
  Globe,
  AlertCircle
} from 'lucide-react';

// Import shared types
import { Receipt as ReceiptType, ExtractedItem, VatBreakdown, ReceiptDetails } from '@/types/receipt';

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/hooks/use-currency';
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ReceiptDetailPage() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  
  const { data: receipt, isLoading, error } = useQuery<ReceiptType>({
    queryKey: ['/api/receipts', id],
    queryFn: async () => {
      const response = await fetch(`/api/receipts/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch receipt details');
      }
      return response.json();
    },
    enabled: !!id
  });

  const { data: foodItems = [] } = useQuery<any[]>({
    queryKey: ['/api/receipts', id, 'items'],
    queryFn: async () => {
      const response = await fetch(`/api/receipts/${id}/items`);
      if (!response.ok) {
        throw new Error('Failed to fetch receipt items');
      }
      return response.json();
    },
    enabled: !!id
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !receipt) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full">
          <CircleX className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Receipt Not Found</h2>
          <p className="text-muted-foreground mb-4">The receipt you're looking for doesn't exist or you don't have permission to view it.</p>
          <Button onClick={() => setLocation('/receipts')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Receipts
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const items = foodItems || [];
  const extractedData = receipt.extractedData || {};
  const receiptDetails = extractedData.receiptDetails || {};
  const store = receipt.store || extractedData.store || {};

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setLocation('/receipts')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Receipt Details</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Receipt Info Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Receipt Information</CardTitle>
              <CardDescription>
                Details extracted from your receipt
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Language Badge */}
              {receiptDetails.language && (
                <div className="mb-4">
                  <Badge className="bg-primary/20 hover:bg-primary/30 text-primary font-medium border-0 flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    Receipt Language: {receiptDetails.language}
                  </Badge>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <ShoppingBag className="h-4 w-4 mr-2" /> Store
                    </div>
                    <div className="font-medium">
                      {store?.name || 'Unknown Store'}
                      {store?.id && (
                        <Button 
                          variant="link" 
                          className="p-0 h-auto ml-1" 
                          onClick={() => setLocation(`/stores/${store.id}`)}
                        >
                          View Store
                        </Button>
                      )}
                    </div>
                    {store?.location && (
                      <div className="text-sm text-muted-foreground">
                        {store.location}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4 mr-2" /> Receipt Date
                    </div>
                    <div className="font-medium">
                      {receiptDetails.date ? receiptDetails.date : 
                        (receipt.receiptDate ? 
                          (typeof receipt.receiptDate === 'string' ? format(new Date(receipt.receiptDate), 'PPP') : 'N/A') : 
                          (receipt.uploadDate ? 
                            (typeof receipt.uploadDate === 'string' ? format(new Date(receipt.uploadDate), 'PPP') : 'N/A') : 
                            format(new Date(receipt.createdAt), 'PPP')))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <Clock className="h-4 w-4 mr-2" /> Receipt Time
                    </div>
                    <div className="font-medium">
                      {receiptDetails.time || 
                        (receipt.receiptDate && typeof receipt.receiptDate === 'string' 
                          ? format(new Date(receipt.receiptDate), 'p') 
                          : 'N/A')}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <Receipt className="h-4 w-4 mr-2" /> Receipt Number
                    </div>
                    <div className="font-medium">
                      {receiptDetails.receiptNumber || receipt.receiptNumber || 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <User className="h-4 w-4 mr-2" /> Cashier
                    </div>
                    <div className="font-medium">
                      {receiptDetails.cashier || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <CreditCard className="h-4 w-4 mr-2" /> Payment Method
                    </div>
                    <div className="font-medium">
                      {receiptDetails.paymentMethod || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <DollarSign className="h-4 w-4 mr-2" /> Total Amount
                    </div>
                    <div className="font-medium">
                      {receipt.totalAmount 
                        ? formatCurrency(parseFloat(receipt.totalAmount.toString())) 
                        : (receiptDetails.totalAmount 
                          ? formatCurrency(receiptDetails.totalAmount) 
                          : 'N/A')}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <Tag className="h-4 w-4 mr-2" /> File Details
                    </div>
                    <div className="font-medium">
                      {receipt.fileName}
                    </div>
                    {receipt.fileSize && (
                      <div className="text-sm text-muted-foreground">
                        {(receipt.fileSize / 1024).toFixed(2)} KB
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {receiptDetails.vatBreakdown && receiptDetails.vatBreakdown.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-2">VAT Breakdown</h3>
                  <div className="bg-muted rounded-md p-3">
                    {receiptDetails.vatBreakdown.map((vat: VatBreakdown, index: number) => {
                      return (
                        <div key={index} className="flex justify-between text-sm">
                          <span>VAT {(vat.rate * 100).toFixed(0)}%</span>
                          <span>{formatCurrency(vat.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Display receipt image */}
              {receipt.filePath && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-2">Receipt Image</h3>
                  <div className="border rounded-md overflow-hidden">
                    <img 
                      src={receipt.filePath} 
                      alt="Receipt" 
                      className="w-full h-auto max-h-[500px] object-contain bg-muted"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items Card */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Extracted Items</CardTitle>
              <CardDescription>
                {items.length} items extracted from receipt
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Free tier limit warning */}
              {user && user.subscriptionTier === 'free' && items.length > 0 && (
                <Alert className="mb-4 bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800 text-sm font-medium">Free Tier Limit</AlertTitle>
                  <AlertDescription className="text-xs text-amber-700">
                    Free tier accounts are limited to 50 items per receipt.
                    {items.length >= 45 && items.length <= 50 && (
                      <>
                        <br />
                        <strong>Warning:</strong> This receipt has {items.length} items, approaching the 50-item limit.
                      </>
                    )}
                    {items.length > 50 && (
                      <>
                        <br />
                        <strong>Note:</strong> This receipt has {items.length} items but only the first 50 are saved.
                        Additional items may have been discarded.
                      </>
                    )}
                    <div className="mt-2">
                      <Link to="/subscribe" className="text-primary text-xs font-medium hover:underline">
                        Upgrade to Smart Pantry tier → Unlimited items per receipt
                      </Link>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {items.length > 0 ? (
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="border-b pb-3 last:border-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{item.name}</h4>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity} {item.unit}
                          </div>
                        </div>
                        <div className="text-right">
                          {item.price ? formatCurrency(item.price) : 'N/A'}
                        </div>
                      </div>
                      {item.expiryDate && (
                        <div className="mt-1">
                          <Badge variant="outline" className="text-xs">
                            Expires: {typeof item.expiryDate === 'string' ? format(new Date(item.expiryDate), 'PPP') : 'Unknown'}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No items extracted from this receipt.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}