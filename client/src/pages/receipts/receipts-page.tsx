import { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DashboardLayout } from '@/components/dashboard-layout';
import { ReceiptUpload } from '@/components/receipt-upload';
import { PlusIcon, ArrowUpCircleIcon } from 'lucide-react';

export function ReceiptsPage() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Receipt Management</h1>
          <div className="flex space-x-2">
            <Button 
              onClick={() => setShowUpload(prev => !prev)}
              variant="default"
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
            >
              <ArrowUpCircleIcon className="mr-2 h-4 w-4" />
              {showUpload ? 'Hide Upload' : 'Upload Receipt'}
            </Button>
            <Button 
              asChild
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
            >
              <Link href="/inventory">
                <PlusIcon className="mr-2 h-4 w-4" />
                Add Food Items
              </Link>
            </Button>
          </div>
        </div>

        {showUpload && (
          <Card className="mb-8 border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Upload Receipt</CardTitle>
              <CardDescription>
                Upload a photo of your receipt to automatically extract food items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReceiptUpload />
            </CardContent>
            <CardFooter className="bg-gray-50 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                We'll extract food items, store information, and receipt details automatically.
              </p>
            </CardFooter>
          </Card>
        )}

        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Receipts</CardTitle>
            <CardDescription>
              View and manage your recently uploaded receipts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center p-8 text-gray-500">
              Receipt history feature coming soon.
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}