import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, MailCheck, AlertTriangle, BadgeCheck } from "lucide-react";

export function EmailVerificationStatus() {
  const { user } = useAuth();
  const { toast } = useToast();

  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/email/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Failed to send verification email");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Verification Email Sent",
        description: "Please check your inbox for the verification link",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send verification email",
        variant: "destructive",
      });
    },
  });

  // If user is not logged in, don't show anything
  if (!user) {
    return null;
  }

  // If email is verified or no email set, don't show verification card
  if (user.emailVerified || !user.email) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <CardTitle>Email Verification Required</CardTitle>
        </div>
        <CardDescription>
          Verify your email address to access all features
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Your email is not verified</AlertTitle>
          <AlertDescription>
            We sent a verification link to <strong>{user.email}</strong>. 
            Please check your inbox and click the verification link to unlock full access to all features.
          </AlertDescription>
        </Alert>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            If you don't see the email, check your spam folder or request a new verification link.
          </p>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button
          onClick={() => resendVerificationMutation.mutate()}
          disabled={resendVerificationMutation.isPending}
          className="w-full"
        >
          {resendVerificationMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <MailCheck className="mr-2 h-4 w-4" />
              Resend Verification Email
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function EmailVerifiedBadge() {
  const { user } = useAuth();

  if (!user || !user.email || !user.emailVerified) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
      <BadgeCheck className="h-3.5 w-3.5" />
      <span>Email Verified</span>
    </div>
  );
}