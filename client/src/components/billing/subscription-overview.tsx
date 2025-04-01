import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

interface SubscriptionOverviewProps {
  subscription: any;
  currentTier: any;
  tierIcon: React.ReactNode;
  user: any;
  onManageClick: () => void;
  onChangePlanClick: () => void;
  isResuming: boolean;
}

export function SubscriptionOverview({
  subscription,
  currentTier,
  tierIcon,
  user,
  onManageClick,
  onChangePlanClick,
  isResuming
}: SubscriptionOverviewProps) {
  // Format date helpers
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMMM d, yyyy');
  };

  // Calculate days remaining in billing period
  const getDaysRemaining = () => {
    if (!subscription) return null;
    
    const endDate = new Date(subscription.currentPeriodEnd);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const daysRemaining = subscription ? getDaysRemaining() : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your current subscription plan and status</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {tierIcon}
              <span className="font-semibold text-lg">{currentTier.name}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Plan Price</h3>
                <p className="text-lg font-semibold mt-1">
                  {currentTier.price > 0 
                    ? `$${currentTier.price.toFixed(2)}/month` 
                    : "Free"}
                </p>
              </div>
              
              {subscription && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Billing Period</h3>
                  <p className="text-lg font-semibold mt-1">
                    {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                  </p>
                </div>
              )}
            </div>
            
            {subscription && (
              <>
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Payment Status</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {subscription.status === 'active' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : subscription.status === 'past_due' ? (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      )}
                      <span className="capitalize">{subscription.status}</span>
                    </div>
                  </div>
                  
                  {subscription.cancelAtPeriodEnd && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Cancellation</h3>
                      <p className="text-sm mt-1">
                        Your subscription will end on {formatDate(subscription.currentPeriodEnd)}
                      </p>
                    </div>
                  )}
                  
                  {daysRemaining !== null && !subscription.cancelAtPeriodEnd && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Next Billing</h3>
                      <p className="text-sm mt-1">
                        {daysRemaining} days until next payment
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
                      
            <Separator />
                   
            <div>
              <h3 className="text-sm font-medium">Plan Features</h3>
              <ul className="mt-2 space-y-2">
                {currentTier.features.map((feature: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-4">
          {subscription && (
            <Button
              variant={subscription.cancelAtPeriodEnd ? "default" : "outline"}
              onClick={onManageClick}
              disabled={isResuming}
              className="w-full sm:w-auto"
            >
              {isResuming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {subscription.cancelAtPeriodEnd ? "Resume Subscription" : "Cancel Subscription"}
            </Button>
          )}
          
          <Button 
            className="w-full sm:w-auto"
            onClick={onChangePlanClick}
          >
            {currentTier.price > 0 ? "Change Plan" : "Upgrade Plan"}
          </Button>
        </CardFooter>
      </Card>
      
      {subscription?.status === 'past_due' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Payment Failed</AlertTitle>
          <AlertDescription>
            Your last payment was unsuccessful. Please update your payment method to avoid service interruption.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}