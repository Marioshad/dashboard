import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  billing_details: {
    name: string;
    email?: string;
    address?: {
      country?: string;
      postal_code?: string;
    };
  };
  type: string;
  isDefault?: boolean;
}

interface PaymentMethodSelectorProps {
  paymentMethods: PaymentMethod[];
  onAddPaymentMethod: () => void;
}

export function PaymentMethodSelector({ 
  paymentMethods,
  onAddPaymentMethod
}: PaymentMethodSelectorProps) {
  // Format card expiry
  const formatExpiry = (month: number, year: number): string => {
    return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
  };

  // Format card brand
  const formatCardBrand = (brand: string): string => {
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  // Get appropriate icon or style for card brand
  const getCardBrandClass = (brand: string): string => {
    switch (brand.toLowerCase()) {
      case 'visa':
        return 'text-blue-500';
      case 'mastercard':
        return 'text-red-500';
      case 'amex':
        return 'text-blue-400';
      case 'discover':
        return 'text-orange-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Methods</CardTitle>
        <CardDescription>Manage your payment information</CardDescription>
      </CardHeader>
      <CardContent>
        {paymentMethods.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
            <p className="mt-4 text-lg font-medium">No payment methods</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a payment method to manage your subscription
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {paymentMethods.map((method) => (
              <div 
                key={method.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 flex items-center justify-center rounded-md bg-gray-100 ${getCardBrandClass(method.card.brand)}`}>
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center">
                      <span className="font-medium">
                        {formatCardBrand(method.card.brand)} •••• {method.card.last4}
                      </span>
                      {method.isDefault && (
                        <Badge variant="outline" className="ml-2 bg-green-100 text-green-800 hover:bg-green-100">
                          Default
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Expires {formatExpiry(method.card.exp_month, method.card.exp_year)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={onAddPaymentMethod} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Payment Method
        </Button>
      </CardFooter>
    </Card>
  );
}