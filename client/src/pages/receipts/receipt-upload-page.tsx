import { DashboardLayout } from "@/components/dashboard-layout";
import { ReceiptUpload } from "@/components/receipt-upload";

export function ReceiptUploadPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Upload Receipt</h1>
        <ReceiptUpload />
      </div>
    </DashboardLayout>
  );
}

export default ReceiptUploadPage;