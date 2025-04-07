import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function WebhookTestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [tier, setTier] = useState('smart');
  const [status, setStatus] = useState('active');
  const [userId, setUserId] = useState('');
  const [notify, setNotify] = useState(true);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    try {
      const requestOptions = {
        tier,
        status,
        userId: userId ? parseInt(userId) : undefined,
        notify
      };
      const res = await apiRequest('POST', '/api/test-webhook', requestOptions);

      const data = await res.json();
      setResult(data);

      toast({
        title: 'Webhook Test Successful',
        description: 'The test webhook was processed successfully.',
      });
    } catch (error: any) {
      console.error('Webhook test error:', error);
      
      toast({
        title: 'Webhook Test Failed',
        description: error.message || 'An error occurred while testing the webhook.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Subscription Webhook Test</h1>
        
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Test Subscription Webhook</CardTitle>
              <CardDescription>
                Simulate a subscription update webhook to test tier updates without going through Stripe.
              </CardDescription>
            </CardHeader>
            
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tier">Subscription Tier</Label>
                  <Select 
                    value={tier} 
                    onValueChange={setTier}
                  >
                    <SelectTrigger id="tier">
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="smart">Smart Pantry</SelectItem>
                      <SelectItem value="pro">Family Pantry Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Subscription Status</Label>
                  <Select 
                    value={status} 
                    onValueChange={setStatus}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="incomplete">Incomplete</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                      <SelectItem value="past_due">Past Due</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="userId">User ID (optional)</Label>
                  <Input
                    id="userId"
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Leave empty to use current user"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="notify" 
                    checked={notify}
                    onCheckedChange={(checked) => setNotify(!!checked)} 
                  />
                  <Label htmlFor="notify">Send notification</Label>
                </div>
              </CardContent>
              
              <CardFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Test Webhook
                </Button>
              </CardFooter>
            </form>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
              <CardDescription>
                Webhook response will appear here after testing.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {!result && !isLoading && (
                <div className="text-sm text-muted-foreground">
                  No result yet. Submit the form to test the webhook.
                </div>
              )}
              
              {isLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              
              {result && (
                <pre className="p-4 bg-slate-50 rounded-md text-sm overflow-auto max-h-96">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}