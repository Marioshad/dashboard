import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
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
import { Eye, Trash2, ReceiptText, Plus, AlertCircle, Ban } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCurrency } from '@/hooks/use-currency';
import { toast } from '@/hooks/use-toast';
import { ReceiptUpload } from '@/components/receipt-upload';
import { Receipt } from '@/types/receipt';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ReceiptsPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const queryClient = useQueryClient();
  const { formatCurrency } = useCurrency();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<number | null>(null);
  const { user, setUser } = useAuth();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  
  // Setup WebSocket connection
  useEffect(() => {
    // Only create WebSocket if user is logged in
    if (!user || !user.id) return;
    
    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    const newSocket = new WebSocket(wsUrl);
    
    newSocket.onopen = () => {
      console.log('WebSocket connection established');
    };
    
    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        // Handle receipt scan count updates
        if (data.type === 'receipt_scan_count_update' && data.userId === user.id) {
          console.log('Updating receipt scan count:', data);
          setUser({
            ...user,
            receiptScansUsed: data.scansUsed
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    newSocket.onclose = (event) => {
      console.log('WebSocket connection closed:', event);
    };
    
    setSocket(newSocket);
    
    // Cleanup on unmount
    return () => {
      if (newSocket.readyState === WebSocket.OPEN) {
        console.log('Closing WebSocket connection');
        newSocket.close();
      }
    };
  }, [user?.id, setUser]);
  
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
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Receipts</h1>
            <Button 
              onClick={() => setIsUploading(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
              disabled={
                // Disable button if user has reached their scan limit
                user?.receiptScansLimit !== null && 
                user?.receiptScansLimit !== undefined && 
                user?.receiptScansUsed !== null &&
                user?.receiptScansUsed !== undefined &&
                user?.receiptScansUsed >= user?.receiptScansLimit
              }
            >
              {user?.receiptScansLimit !== null && 
                user?.receiptScansLimit !== undefined && 
                user?.receiptScansUsed !== null &&
                user?.receiptScansUsed !== undefined &&
                user?.receiptScansUsed >= user?.receiptScansLimit ? (
                <>
                  <Ban className="w-4 h-4 mr-2" /> Limit Reached
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" /> Upload Receipt
                </>
              )}
            </Button>
          </div>
          
          {/* Subscription usage indicator */}
          {user && user.subscriptionTier !== 'pro' && (user.receiptScansLimit ?? 0) > 0 && (
            <>
              <div className="flex items-center gap-2 rounded-lg p-2 bg-muted/50 text-sm">
                <div className="flex flex-1 flex-col xs:flex-row xs:items-center gap-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={user.subscriptionTier === 'free' ? 'outline' : 'default'} className="capitalize">
                      {user.subscriptionTier} Tier
                    </Badge>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center">
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="w-[220px]">
                            <p><strong>Receipt Scan Limits</strong></p>
                            <p className="text-xs mt-1">• Free: 3 scans per period, 50 items per receipt</p>
                            <p className="text-xs">• Smart Pantry: 20 scans per period</p>
                            <p className="text-xs">• Family Pantry Pro: Unlimited scans</p>
                            <div className="mt-1 text-xs">
                              <Link to="/subscribe" className="text-primary underline">
                                Upgrade your plan
                              </Link>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="text-muted-foreground flex-1">
                    <span>
                      Receipt Scans Remaining: <strong>{Math.max(0, (user.receiptScansLimit ?? 0) - (user.receiptScansUsed ?? 0))}/{user.receiptScansLimit ?? 0}</strong>
                    </span>
                  </div>
                </div>
                
                {user.subscriptionTier === 'free' && (
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <Link to="/subscribe">
                      Upgrade
                    </Link>
                  </Button>
                )}
              </div>
              
              {/* Warning message when scan limit is reached */}
              {user?.receiptScansLimit !== null && 
               user?.receiptScansLimit !== undefined && 
               user?.receiptScansUsed !== null &&
               user?.receiptScansUsed !== undefined &&
               user?.receiptScansUsed >= user?.receiptScansLimit && (
                <div className="mt-2 text-amber-800 font-medium bg-amber-100 p-3 rounded-md border border-amber-300 flex justify-between items-center text-sm">
                  <div>
                    <span className="font-bold">Scan Limit Reached!</span> You've used all {user.receiptScansLimit} receipt scans for this billing period.
                  </div>
                  <Button variant="secondary" size="sm" asChild className="bg-amber-200 hover:bg-amber-300 h-8 ml-4 shrink-0">
                    <Link to="/subscribe">Upgrade Plan</Link>
                  </Button>
                </div>
              )}
            </>
          )}
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
              {user?.receiptScansLimit !== null && 
               user?.receiptScansLimit !== undefined && 
               user?.receiptScansUsed !== null &&
               user?.receiptScansUsed !== undefined &&
               user?.receiptScansUsed >= user?.receiptScansLimit ? (
                <div className="mt-2 mb-6 mx-auto max-w-md">
                  <div className="text-amber-800 font-medium bg-amber-100 p-3 rounded-md border border-amber-300 text-sm text-center">
                    <p className="font-bold">Scan Limit Reached!</p>
                    <p className="mt-1">You've used all {user.receiptScansLimit} receipt scans for this billing period.</p>
                    <Button variant="secondary" size="sm" className="bg-amber-200 hover:bg-amber-300 h-8 mt-3">
                      <Link to="/subscribe">Upgrade Your Plan</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground mb-6">Upload your first receipt to get started.</p>
              )}
              <Button 
                onClick={() => setIsUploading(true)}
                className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
                disabled={
                  // Disable button if user has reached their scan limit
                  user?.receiptScansLimit !== null && 
                  user?.receiptScansLimit !== undefined && 
                  user?.receiptScansUsed !== null &&
                  user?.receiptScansUsed !== undefined &&
                  user?.receiptScansUsed >= user?.receiptScansLimit
                }
              >
                {user?.receiptScansLimit !== null && 
                 user?.receiptScansLimit !== undefined && 
                 user?.receiptScansUsed !== null &&
                 user?.receiptScansUsed !== undefined &&
                 user?.receiptScansUsed >= user?.receiptScansLimit ? (
                  <>
                    <Ban className="w-4 h-4 mr-2" /> Limit Reached
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" /> Upload Receipt
                  </>
                )}
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