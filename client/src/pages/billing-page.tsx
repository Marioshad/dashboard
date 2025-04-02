import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, ShieldCheck, CreditCard, Receipt, File, ExternalLink, AlertCircle, CheckCircle2, Clock, XCircle, Plus, UserPlus, Shield, Zap, Users } from "lucide-react";
import { format } from "date-fns";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription";
import { PaymentMethodSelector } from "../components/billing/payment-method-selector";
import { SubscriptionOverview } from "../components/billing/subscription-overview";
import { InvoiceList } from "../components/billing/invoice-list";
import { useLocation } from "wouter";

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Fetch subscription details
  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ["/api/billing/subscription"],
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Fetch invoices
  const { data: invoicesData, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ["/api/billing/invoices"],
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Fetch payment methods
  const { data: paymentMethodsData, isLoading: isLoadingPaymentMethods } = useQuery({
    queryKey: ["/api/billing/payment-methods"],
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/billing/cancel-subscription", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      toast({
        title: "Subscription Canceled",
        description: "Your subscription will end at the end of the billing period.",
      });
      setCancelDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  // Resume subscription mutation
  const resumeSubscriptionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/billing/resume-subscription", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      toast({
        title: "Subscription Resumed",
        description: "Your subscription will renew automatically.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resume subscription",
        variant: "destructive",
      });
    },
  });

  const subscription = subscriptionData?.subscription;
  const invoices = invoicesData?.invoices || [];
  const paymentMethods = paymentMethodsData?.paymentMethods || [];
  const stripeDisabled = subscriptionData?.stripeDisabled;

  // Get current tier information
  const currentTier = SUBSCRIPTION_TIERS.find(tier => tier.id === (user?.subscriptionTier || 'free')) || SUBSCRIPTION_TIERS[0];
  const tierIcon = currentTier.id === 'free' 
    ? <Shield className="h-6 w-6 text-slate-500" />
    : currentTier.id === 'smart'
      ? <Zap className="h-6 w-6 text-amber-500" />
      : <Users className="h-6 w-6 text-indigo-500" />;

  // Check if loading
  const isLoading = isLoadingSubscription || isLoadingInvoices || isLoadingPaymentMethods;

  // Determine subscription status for UI
  const getStatusBadge = () => {
    // For free tier
    if (!subscription || currentTier.id === 'free') {
      return <Badge variant="outline">Free Plan</Badge>;
    }
    
    if (subscription.status === 'active') {
      if (subscription.cancelAtPeriodEnd) {
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Cancels on {format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}</Badge>;
      }
      return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
    }
    
    if (subscription.status === 'past_due') {
      return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">Past Due</Badge>;
    }
    
    if (subscription.status === 'canceled') {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-gray-100">Canceled</Badge>;
    }
    
    return <Badge variant="outline">{subscription.status}</Badge>;
  };

  if (stripeDisabled) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <h1 className="text-3xl font-bold tracking-tight">Billing & Subscription</h1>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Payment Service Unavailable</AlertTitle>
            <AlertDescription>
              The payment service is currently unavailable. Please contact the administrator.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Billing & Subscription</h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {tierIcon}
              <span className="font-medium mr-2">{currentTier.name}</span>
            </div>
            {getStatusBadge()}
          </div>
        </div>

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="invoices">Invoices & Receipts</TabsTrigger>
            <TabsTrigger value="payment">Payment Methods</TabsTrigger>
          </TabsList>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <TabsContent value="overview" className="space-y-4">
                <SubscriptionOverview 
                  subscription={subscription}
                  currentTier={currentTier}
                  tierIcon={tierIcon}
                  user={user}
                  onManageClick={() => {
                    if (subscription?.cancelAtPeriodEnd) {
                      resumeSubscriptionMutation.mutate();
                    } else {
                      setCancelDialogOpen(true);
                    }
                  }}
                  onChangePlanClick={() => setLocation("/subscribe")}
                  isResuming={resumeSubscriptionMutation.isPending}
                />
              </TabsContent>
              
              <TabsContent value="invoices">
                <InvoiceList 
                  invoices={invoices}
                  isLoading={isLoadingInvoices}
                  currency={user?.currency || "USD"}
                />
              </TabsContent>
              
              <TabsContent value="payment">
                <PaymentMethodSelector 
                  paymentMethods={paymentMethods}
                  onAddPaymentMethod={() => setPaymentDialogOpen(true)}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Your Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your subscription will remain active until the end of the current billing period 
              ({format(new Date(subscription?.currentPeriodEnd || new Date()), 'MMMM d, yyyy')}). 
              After that, your account will be downgraded to the free plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cancelSubscriptionMutation.mutate();
              }}
              disabled={cancelSubscriptionMutation.isPending}
            >
              {cancelSubscriptionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Method Dialog would be added here using the PaymentMethodForm component */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Enter your card details to add a new payment method.
            </DialogDescription>
          </DialogHeader>
          
          {/* Here you would add the Stripe Elements Card component */}
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This feature requires additional Stripe integration. Please use the Stripe Dashboard to manage payment methods.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}