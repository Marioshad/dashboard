import { DashboardLayout } from "@/components/dashboard-layout";
import { ReceiptUpload } from "@/components/receipt-upload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Eye, Calendar, Store, ReceiptText, FileCog } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { queryClient } from "@/lib/queryClient";

// Format date for display
const formatDate = (dateString: string) => {
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
const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

export default function ReceiptsPage() {
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);
  
  // Fetch receipts
  const { data: receipts, isLoading, error } = useQuery({
    queryKey: ['/api/receipts'],
    queryFn: async () => {
      const response = await fetch('/api/receipts');
      if (!response.ok) {
        throw new Error('Failed to fetch receipts');
      }
      return response.json();
    }
  });
  
  // Handle receipt deletion
  const handleDeleteReceipt = async () => {
    if (!selectedReceiptId) return;
    
    try {
      const response = await fetch(`/api/receipts/${selectedReceiptId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete receipt');
      }
      
      // Invalidate receipts query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      
      // Reset selected receipt ID
      setSelectedReceiptId(null);
    } catch (error) {
      console.error('Error deleting receipt:', error);
    }
  };
  
  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Receipts</h1>
            <p className="text-muted-foreground">Upload and manage your purchase receipts</p>
          </div>
          
          <ReceiptUpload />
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Receipt History</CardTitle>
            <CardDescription>View all your uploaded receipts and extracted data</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border rounded-md">
                    <Skeleton className="h-12 w-12" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-4 border border-red-200 rounded-md bg-red-50 text-red-700">
                Failed to load receipts. Please try again later.
              </div>
            ) : receipts && receipts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b text-sm font-medium">
                      <th className="px-4 py-2 text-left">Receipt</th>
                      <th className="px-4 py-2 text-left">Upload Date</th>
                      <th className="px-4 py-2 text-left">Store</th>
                      <th className="px-4 py-2 text-left">Amount</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((receipt: any) => (
                      <tr key={receipt.id} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <ReceiptText className="h-5 w-5 text-gray-500" />
                            <div className="font-medium">
                              {receipt.fileName.length > 25 
                                ? receipt.fileName.substring(0, 25) + '...' 
                                : receipt.fileName}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <span>{formatDate(receipt.uploadDate)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1">
                            <Store className="h-4 w-4 text-gray-500" />
                            <span>
                              {receipt.extractedData?.store?.name || 'Unknown Store'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {formatCurrency(receipt.totalAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            <Link href={`/receipts/${receipt.id}`}>
                              <Button variant="outline" size="sm" className="flex items-center space-x-1">
                                <Eye className="h-4 w-4" />
                                <span>View</span>
                              </Button>
                            </Link>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="flex items-center space-x-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setSelectedReceiptId(receipt.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this receipt? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setSelectedReceiptId(null)}>
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction onClick={handleDeleteReceipt} className="bg-red-600 hover:bg-red-700">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileCog className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium">No receipts found</h3>
                <p className="text-muted-foreground mt-1">
                  Upload a receipt to get started with automatic data extraction.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}