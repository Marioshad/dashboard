import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, RefreshCw, X, AlertCircle } from 'lucide-react';

interface StripeSettings {
  priceSmartMonthly: string;
  priceSmartYearly: string;
  priceProMonthly: string;
  priceProYearly: string;
  prodSmart: string;
  prodPro: string;
}

export default function StripeSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; accountId?: string; apiVersion?: string; message?: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [plansUpdated, setPlansUpdated] = useState(false);
  const [settings, setSettings] = useState<StripeSettings>({
    priceSmartMonthly: '',
    priceSmartYearly: '',
    priceProMonthly: '',
    priceProYearly: '',
    prodSmart: '',
    prodPro: ''
  });

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        // Use fetch directly for more control
        const response = await fetch('/api/admin/stripe-settings', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setSettings(data);
      } catch (error) {
        console.error('Error fetching Stripe settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load Stripe settings',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [toast]);

  // Check if plans are configured - only consider actual product/price IDs that start with prod_ or price_
  const hasSmartPlan = !!(
    settings.prodSmart && settings.prodSmart.startsWith('prod_') && 
    (
      (settings.priceSmartMonthly && settings.priceSmartMonthly.startsWith('price_')) || 
      (settings.priceSmartYearly && settings.priceSmartYearly.startsWith('price_'))
    )
  );
  const hasProPlan = !!(
    settings.prodPro && settings.prodPro.startsWith('prod_') && 
    (
      (settings.priceProMonthly && settings.priceProMonthly.startsWith('price_')) || 
      (settings.priceProYearly && settings.priceProYearly.startsWith('price_'))
    )
  );
  const hasPlans = hasSmartPlan || hasProPlan;

  // Check if plans configuration has changed
  useEffect(() => {
    setPlansUpdated(true);
    
    // Reset the updated flag after 3 seconds
    const timer = setTimeout(() => {
      setPlansUpdated(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [settings.prodSmart, settings.prodPro, settings.priceSmartMonthly, settings.priceSmartYearly, 
      settings.priceProMonthly, settings.priceProYearly]);

  // Save settings
  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Use fetch directly for more control
      const response = await fetch('/api/admin/stripe-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Stripe settings saved successfully',
          variant: 'default',
        });
        
        // Update local state with the returned settings
        if (data.settings) {
          setSettings(data.settings);
        }
        
        // Force subscription plans update after saving
        try {
          const updatePlansResponse = await fetch('/api/admin/update-subscription-plans', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });
          
          if (updatePlansResponse.ok) {
            const plansData = await updatePlansResponse.json();
            if (plansData.success) {
              toast({
                title: 'Success',
                description: 'Subscription plans updated successfully',
                variant: 'default',
              });
            }
          }
        } catch (plansError) {
          console.error('Error updating subscription plans:', plansError);
          // Don't show an error toast here as the settings were saved successfully
        }
      } else {
        throw new Error(data.message || 'Failed to save settings');
      }
    } catch (error: any) {
      console.error('Error saving Stripe settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save Stripe settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test Stripe connection
  const testConnection = async () => {
    setTestLoading(true);
    setTestResult(null);
    
    try {
      // Use fetch directly for more control
      const response = await fetch('/api/admin/stripe-test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setTestResult({
          success: true,
          accountId: data.accountId,
          apiVersion: data.apiVersion
        });
        
        toast({
          title: 'Success',
          description: 'Successfully connected to Stripe API',
          variant: 'default',
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || 'Connection test failed'
        });
        
        toast({
          title: 'Connection Failed',
          description: data.message || 'Failed to connect to Stripe API',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error testing Stripe connection:', error);
      setTestResult({
        success: false,
        message: error.message || 'Connection test failed'
      });
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to test Stripe connection',
        variant: 'destructive',
      });
    } finally {
      setTestLoading(false);
    }
  };

  // Reset all subscription data
  const resetSubscriptions = async () => {
    // Confirm before proceeding
    if (!confirm('WARNING: This will reset ALL subscription data for ALL users. This action cannot be undone. Are you sure you want to proceed?')) {
      return;
    }
    
    setResetLoading(true);
    
    try {
      // Use fetch directly for more control
      const response = await fetch('/api/admin/reset-all-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Success',
          description: `All subscription data has been reset (${data.count} users affected)`,
          variant: 'default',
        });
      } else {
        throw new Error(data.message || 'Failed to reset subscription data');
      }
    } catch (error: any) {
      console.error('Error resetting subscription data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset subscription data',
        variant: 'destructive',
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Stripe Settings</CardTitle>
            <CardDescription>
              Configure Stripe product and price IDs for subscription plans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Smart Pantry Plan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prodSmart">Product ID</Label>
                    <Input
                      id="prodSmart"
                      value={settings.prodSmart}
                      onChange={(e) => setSettings({ ...settings, prodSmart: e.target.value })}
                      placeholder="prod_..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Stripe Product ID for Smart Pantry plan
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceSmartMonthly">Monthly Price ID</Label>
                    <Input
                      id="priceSmartMonthly"
                      value={settings.priceSmartMonthly}
                      onChange={(e) => setSettings({ ...settings, priceSmartMonthly: e.target.value })}
                      placeholder="price_..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Stripe Price ID for monthly subscription
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceSmartYearly">Yearly Price ID</Label>
                    <Input
                      id="priceSmartYearly"
                      value={settings.priceSmartYearly}
                      onChange={(e) => setSettings({ ...settings, priceSmartYearly: e.target.value })}
                      placeholder="price_..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Stripe Price ID for yearly subscription
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-medium mb-4">Family Pantry Pro Plan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prodPro">Product ID</Label>
                    <Input
                      id="prodPro"
                      value={settings.prodPro}
                      onChange={(e) => setSettings({ ...settings, prodPro: e.target.value })}
                      placeholder="prod_..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Stripe Product ID for Family Pantry Pro plan
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceProMonthly">Monthly Price ID</Label>
                    <Input
                      id="priceProMonthly"
                      value={settings.priceProMonthly}
                      onChange={(e) => setSettings({ ...settings, priceProMonthly: e.target.value })}
                      placeholder="price_..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Stripe Price ID for monthly subscription
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceProYearly">Yearly Price ID</Label>
                    <Input
                      id="priceProYearly"
                      value={settings.priceProYearly}
                      onChange={(e) => setSettings({ ...settings, priceProYearly: e.target.value })}
                      placeholder="price_..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Stripe Price ID for yearly subscription
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            {/* Plans Status Section */}
            <div className="w-full mb-4">
              <h3 className="text-md font-medium mb-2">Subscription Plans Status</h3>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${hasSmartPlan ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Smart Pantry Plan: {hasSmartPlan ? 'Configured' : 'None'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${hasProPlan ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Family Pantry Pro Plan: {hasProPlan ? 'Configured' : 'None'}</span>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <div className={`w-3 h-3 rounded-full ${hasPlans ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className={`font-medium ${hasPlans ? 'text-green-600' : 'text-red-600'}`}>
                    {hasPlans ? 'At least one plan is configured' : 'No subscription plans configured'}
                  </span>
                </div>
                {plansUpdated && (
                  <div className="text-sm text-blue-600 animate-pulse mt-1">
                    Subscription plan configuration updated. Save to apply changes.
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-between w-full">
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button variant="outline" onClick={testConnection} disabled={testLoading}>
                {testLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
            </div>
            
            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Connection Successful</AlertTitle>
                    <AlertDescription>
                      Connected to Stripe account: {testResult.accountId}
                      <br />
                      API Version: {testResult.apiVersion}
                    </AlertDescription>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    <AlertTitle>Connection Failed</AlertTitle>
                    <AlertDescription>{testResult.message}</AlertDescription>
                  </>
                )}
              </Alert>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Advanced Options</CardTitle>
            <CardDescription>
              These actions should only be used in specific situations, such as when troubleshooting 
              subscription issues or migrating your Stripe account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                The actions below are destructive and cannot be undone. Use them only when necessary.
              </AlertDescription>
            </Alert>

            <div className="space-y-8">
              <div>
                <h3 className="text-md font-medium mb-2">Reset All Subscription Data</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  This will reset all subscription data for all users. Users will need to resubscribe.
                  Use this when encountering "No such subscription" errors or when migrating to a new Stripe account.
                </p>
                <Button 
                  variant="destructive" 
                  onClick={resetSubscriptions} 
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Resetting...' : 'Reset All Subscriptions'}
                </Button>
              </div>
              
              <div>
                <h3 className="text-md font-medium mb-2">Sync Database with Stripe</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  This will retrieve all subscription products and prices from Stripe and update the database settings.
                  Use this if the database settings don't match what's in your Stripe account.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/admin/stripe-sync-products', {
                          method: 'GET',
                          credentials: 'include'
                        });
                        
                        if (!response.ok) {
                          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                        }
                        
                        const data = await response.json();
                        if (data.success) {
                          toast({
                            title: 'Success',
                            description: `Found ${data.products.length} products and ${data.prices.length} prices in Stripe`,
                            variant: 'default',
                          });
                        }
                      } catch (error: any) {
                        toast({
                          title: 'Error',
                          description: error.message || 'Failed to get products from Stripe',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    Get Products from Stripe
                  </Button>
                  
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/admin/stripe-clean-plans', {
                          method: 'POST',
                          credentials: 'include'
                        });
                        
                        if (!response.ok) {
                          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                        }
                        
                        const data = await response.json();
                        if (data.success) {
                          toast({
                            title: 'Success',
                            description: `Archived ${data.productsArchived} products and ${data.pricesArchived} prices in Stripe`,
                            variant: 'default',
                          });
                          
                          // Refresh the settings by calling the same function from useEffect
                          setIsLoading(true);
                          fetch('/api/admin/stripe-settings', {
                            method: 'GET',
                            credentials: 'include'
                          })
                            .then(res => res.json())
                            .then(data => {
                              setSettings(data);
                              setIsLoading(false);
                            })
                            .catch(error => {
                              console.error('Error fetching settings:', error);
                              setIsLoading(false);
                            });
                        }
                      } catch (error: any) {
                        toast({
                          title: 'Error',
                          description: error.message || 'Failed to clean plans in Stripe',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    Clean Plans in Stripe
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}