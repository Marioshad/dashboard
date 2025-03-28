import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { Eye, ShoppingBag, Trash2, Upload, Loader2 } from 'lucide-react';

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReceiptUpload } from '@/components/receipt-upload';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export interface Receipt {
  id: number;
  userId: number;
  storeId?: number;
  store?: {
    id: number;
    name: string;
    location: string;
  };
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadDate: string;
  receiptDate?: string;
  receiptNumber?: string;
  totalAmount?: number;
  extractedData?: any;
  createdAt: string;
  updatedAt: string;
}

export function ReceiptsPage() {
  const [, setLocation] = useLocation();
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);

  const { data: receipts, isLoading, error } = useQuery<Receipt[]>({
    queryKey: ['/api/receipts'],
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Receipts</h1>
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                <Upload className="h-4 w-4 mr-2" />
                Upload Receipt
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Upload Receipt</DialogTitle>
                <DialogDescription>
                  Upload a receipt image to extract items automatically.
                </DialogDescription>
              </DialogHeader>
              <ReceiptUpload onSuccess={() => setIsUploadOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Receipts</CardTitle>
              <CardDescription>
                Manage and review all your uploaded receipts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="text-center py-8 text-destructive">
                  <p>Error loading receipts. Please try again later.</p>
                </div>
              ) : receipts && receipts.length > 0 ? (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipts.map((receipt) => (
                        <TableRow key={receipt.id}>
                          <TableCell className="font-medium">
                            <div>
                              Receipt #{receipt.id}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {receipt.receiptNumber || 'No receipt number'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              {receipt.store ? receipt.store.name : (
                                receipt.extractedData?.store?.name || 'Unknown Store'
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {receipt.store ? receipt.store.location : (
                                receipt.extractedData?.store?.location || ''
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              {receipt.receiptDate 
                                ? format(new Date(receipt.receiptDate), 'MMM d, yyyy') 
                                : format(new Date(receipt.uploadDate), 'MMM d, yyyy')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {receipt.uploadDate && format(new Date(receipt.uploadDate), 'h:mm a')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="truncate max-w-[150px]">
                              {receipt.fileName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(receipt.fileSize / 1024).toFixed(2)} KB
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {receipt.totalAmount 
                              ? new Intl.NumberFormat('en-US', { 
                                  style: 'currency', 
                                  currency: 'USD'
                                }).format(parseFloat(receipt.totalAmount.toString())) 
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setLocation(`/receipts/${receipt.id}`)}
                                title="View Receipt"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setLocation(`/stores/${receipt.storeId}`)}
                                disabled={!receipt.storeId}
                                title="View Store"
                              >
                                <ShoppingBag className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete Receipt"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No receipts found. Upload your first receipt to get started.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}