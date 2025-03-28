import { ReceiptUpload } from "@/components/receipt-upload";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import { useLocation } from "wouter";

export function ReceiptsPage() {
  const [, navigate] = useLocation();

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Receipt Upload</h1>
            <p className="text-muted-foreground">
              Upload your grocery receipts to automatically add items to your inventory
            </p>
          </div>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => navigate("/")}
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Receipt</CardTitle>
            <CardDescription>
              Upload a picture of your receipt to automatically extract items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReceiptUpload />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}