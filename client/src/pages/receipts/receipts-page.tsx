import React, { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Link, useLocation, useRoute } from 'wouter';
import { Eye, Trash2, ReceiptText, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCurrency } from '@/hooks/use-currency';
import { toast } from '@/hooks/use-toast';
import { ReceiptUpload } from '@/components/receipt-upload';
import { Receipt } from '@/types/receipt';

export function ReceiptsPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const queryClient = useQueryClient();
  const { formatCurrency } = useCurrency();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<number | null>(null);
  
  const { data: receipts = [], isLoading, error } = useQuery<Receipt[]>({
    queryKey: ['/api/receipts'],
  });

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/receipts/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete receipt');
      }

      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      toast({
        title: 'Receipt deleted',
        description: 'Receipt has been deleted successfully',
      });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting receipt:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete receipt. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const confirmDelete = (id: number) => {
    setReceiptToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleUploadSuccess = () => {
    setIsUploaded(true);
    setIsUploading(false);
    queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
    toast({
      title: 'Receipt uploaded',
      description: 'Receipt has been uploaded and processed successfully',
    });
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Receipts</h1>
          <Button 
            onClick={() => setIsUploading(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
          >
            <Plus className="w-4 h-4 mr-2" /> Upload Receipt
          </Button>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center">Loading receipts...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-red-500">Error loading receipts. Please try again.</p>
            </CardContent>
          </Card>
        ) : receipts.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-10">
              <ReceiptText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No receipts found</p>
              <p className="text-muted-foreground mb-6">Upload your first receipt to get started.</p>
              <Button 
                onClick={() => setIsUploading(true)}
                className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
              >
                <Plus className="w-4 h-4 mr-2" /> Upload Receipt
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Your Receipts</CardTitle>
              <CardDescription>
                View and manage all your uploaded receipts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((receipt: Receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell>
                        {receipt.receiptDate 
                          ? format(new Date(receipt.receiptDate), 'PPP') 
                          : receipt.uploadDate 
                            ? format(new Date(receipt.uploadDate), 'PPP')
                            : format(new Date(receipt.createdAt), 'PPP')
                        }
                      </TableCell>
                      <TableCell>{receipt.store?.name || 'Unknown Store'}</TableCell>
                      <TableCell>{receipt.receiptNumber || '-'}</TableCell>
                      <TableCell>
                        {receipt.totalAmount !== undefined && receipt.totalAmount !== null 
                          ? formatCurrency(receipt.totalAmount) 
                          : '-'
                        }
                      </TableCell>
                      <TableCell>{receipt.paymentMethod || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon" asChild>
                            <Link to={`/receipts/${receipt.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => confirmDelete(receipt.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Receipt Upload Dialog */}
        <Dialog 
          open={isUploading} 
          onOpenChange={(open) => {
            setIsUploading(open);
            if (!open && isUploaded) {
              setIsUploaded(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Upload Receipt</DialogTitle>
              <DialogDescription>
                Upload a receipt to extract items and store information.
              </DialogDescription>
            </DialogHeader>
            <ReceiptUpload onSuccess={handleUploadSuccess} />
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this receipt? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => receiptToDelete && handleDelete(receiptToDelete)}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}