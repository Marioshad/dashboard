import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, AlertTriangle, CheckCircle2, Info, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function EmailTestCard() {
  const { toast } = useToast();
  const [adminEmail, setAdminEmail] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email test mutation
  const emailTestMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/email/test", {
        method: "POST",
        body: JSON.stringify({ adminEmail: adminEmail || null }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Test Email Sent",
        description: data.message || "Test email has been sent successfully.",
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000); // Hide success message after 5 seconds
      setError(null);
    },
    onError: async (error: any) => {
      let errorMessage = "Failed to send test email";
      let detailedError = null;
      
      try {
        // Try to get detailed error information from the response
        const response = await error.response?.json();
        
        if (response) {
          errorMessage = response.message || errorMessage;
          
          // Handle specific error codes
          if (response.error === 'SENDGRID_NOT_CONFIGURED') {
            detailedError = 'The email service (SendGrid) is not properly configured. Please ask the administrator to set up the SendGrid API key.';
          } else if (response.error === 'SENDGRID_SENDER_VERIFICATION') {
            detailedError = 'Email sending failed because the sender email address is not verified in SendGrid. The admin needs to verify the domain or sender email in the SendGrid dashboard.';
          } else if (response.error === 'USER_EMAIL_MISSING') {
            detailedError = 'You need to add an email address to your account before you can test email notifications.';
          }
        }
      } catch (jsonError) {
        console.error('Error parsing error response:', jsonError);
      }
      
      toast({
        title: "Email Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      setError(detailedError || errorMessage);
      setShowSuccess(false);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Mail className="mr-2 h-5 w-5" />
          Email Notifications Test
        </CardTitle>
        <CardDescription>
          Verify that your email notifications are working properly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {showSuccess && (
          <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>
              Test email has been sent successfully. Please check your inbox.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="adminEmail">Admin Email (optional)</Label>
          <Input
            id="adminEmail"
            placeholder="admin@example.com"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            If provided, a copy of the test email will also be sent to this address
          </p>
        </div>

        <div className="pt-2">
          <Button
            onClick={() => emailTestMutation.mutate()}
            disabled={emailTestMutation.isPending}
            className="w-full md:w-auto"
          >
            {emailTestMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Send Test Email
          </Button>
        </div>
      </CardContent>
      <Separator />
      <CardFooter className="pt-4 text-xs text-muted-foreground">
        A test email will be sent to your account email address to verify that the notification system is working correctly.
      </CardFooter>
    </Card>
  );
}