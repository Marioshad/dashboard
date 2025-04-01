import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, File, ExternalLink, CheckCircle2, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";

interface Invoice {
  id: string;
  number: string;
  status: string;
  created: number;
  amount_due: number;
  amount_paid: number;
  hosted_invoice_url?: string;
  invoice_pdf?: string;
}

interface InvoiceListProps {
  invoices: Invoice[];
  isLoading: boolean;
  currency: string;
}

export function InvoiceList({ invoices, isLoading, currency }: InvoiceListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Format money helper
  const formatMoney = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount / 100);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">Paid</Badge>;
      case 'open':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Open</Badge>;
      case 'void':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-gray-100">Void</Badge>;
      case 'uncollectible':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">Uncollectible</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'open':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'void':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      case 'uncollectible':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices & Receipts</CardTitle>
        <CardDescription>View and download your invoice history</CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-8">
            <File className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
            <p className="mt-4 text-lg font-medium">No invoices yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Invoices will appear here after your first payment
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    {invoice.number || `Invoice #${invoice.id.slice(-8)}`}
                  </TableCell>
                  <TableCell>
                    {format(new Date(invoice.created * 1000), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(invoice.status)}
                      {getStatusBadge(invoice.status)}
                    </div>
                  </TableCell>
                  <TableCell>{formatMoney(invoice.amount_due)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {invoice.hosted_invoice_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a 
                          href={invoice.hosted_invoice_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </a>
                      </Button>
                    )}
                    {invoice.invoice_pdf && (
                      <Button size="sm" variant="outline" asChild>
                        <a 
                          href={invoice.invoice_pdf} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <File className="h-4 w-4 mr-1" />
                          PDF
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}