import { DashboardLayout } from "@/components/dashboard-layout";
import { ReceiptUpload } from "@/components/receipt-upload";

export default function ReceiptsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receipt Scanner</h1>
          <p className="text-muted-foreground">
            Upload and scan your grocery receipts to add items to your inventory
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <ReceiptUpload />
          
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">How it works</h3>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Take a clear photo of your receipt</li>
                <li>Upload the image using the form</li>
                <li>Our system will scan for food items</li>
                <li>Review and add items to your inventory</li>
              </ol>
            </div>
            
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">Tips for best results</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>Make sure the receipt is well-lit and focused</li>
                <li>Flatten the receipt to avoid wrinkles</li>
                <li>Include the entire receipt in the frame</li>
                <li>Manually add any items that weren't detected</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}