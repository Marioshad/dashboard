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
        const response = await apiRequest('GET', '/api/admin/stripe-settings', {});
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

  // Save settings
  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/admin/stripe-settings', { 
        body: JSON.stringify(settings),
        headers: { 'Content-Type': 'application/json' }
      });
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
      const response = await apiRequest('POST', '/api/admin/stripe-test-connection', {
        headers: { 'Content-Type': 'application/json' }
      });
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
      const response = await apiRequest('POST', '/api/admin/reset-all-subscriptions', {
        headers: { 'Content-Type': 'application/json' }
      });
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

            <div className="space-y-4">
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
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}