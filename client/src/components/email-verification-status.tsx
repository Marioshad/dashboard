import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { Link } from 'wouter';
import { Badge } from "@/components/ui/badge";

/**
 * Email verified badge component
 * Shows a badge indicating email verification status
 */
export function EmailVerifiedBadge() {
  const { user } = useAuth();
  
  if (!user) return null;
  
  const isVerified = user.emailVerified;
  
  if (isVerified) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
        <Check className="mr-1 h-3 w-3" />
        Email Verified
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="bg-amber-50 text-amber-700 hover:bg-amber-50">
      <AlertTriangle className="mr-1 h-3 w-3" />
      Verification Needed
    </Badge>
  );
}

/**
 * Email verification status component
 * Shows the email verification status and provides actions to verify or resend verification email
 */
export default function EmailVerificationStatus() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isResending, setIsResending] = React.useState(false);
  
  // Get email verification status
  const isVerified = user?.emailVerified;
  const userEmail = user?.email;
  
  if (!user) return null;
  
  // Handler for resending verification email
  const handleResendVerification = async () => {
    try {
      setIsResending(true);
      const response = await apiRequest("/api/email/resend-verification", {
        method: "POST"
      });
      const data = await response.json();
      
      toast({
        title: data.success ? "Verification Email Sent" : "Could not send verification email",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      
      // Invalidate user data to refresh verification status
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not resend verification email. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-xl">
          {isVerified ? (
            <Check className="h-5 w-5 mr-2 text-green-500" />
          ) : (
            <Mail className="h-5 w-5 mr-2 text-amber-500" />
          )}
          Email Verification
        </CardTitle>
        <CardDescription>
          {isVerified 
            ? "Your email has been verified." 
            : "Your email needs to be verified to use all features."}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className={`bg-${isVerified ? 'green-50' : 'amber-50'} p-4 rounded-md border ${isVerified ? 'border-green-100' : 'border-amber-100'}`}>
          <div className="flex items-start mb-2">
            {isVerified ? (
              <Check className="h-5 w-5 mt-0.5 mr-2 text-green-500 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 mt-0.5 mr-2 text-amber-500 flex-shrink-0" />
            )}
            <div>
              <div className="font-medium">
                {isVerified ? "Email Verified" : "Verification Required"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {isVerified 
                  ? `Your email (${userEmail}) has been successfully verified.` 
                  : `We've sent a verification link to ${userEmail}. Please check your email and click the link to verify your address.`}
              </div>
            </div>
          </div>
          
          {!isVerified && (
            <div className="mt-3 text-sm text-muted-foreground">
              <p>Without email verification, you won't be able to:</p>
              <ul className="list-disc list-inside mt-1 ml-2 space-y-1">
                <li>Add or edit items in your pantry</li>
                <li>Create new locations or stores</li>
                <li>Upload and process receipts</li>
                <li>Use any premium features</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
      
      {!isVerified && (
        <CardFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleResendVerification}
            disabled={isResending}
            className="w-full sm:w-auto"
          >
            {isResending ? "Sending..." : "Resend Verification Email"}
          </Button>
          
          <Link href="/verify-email">
            <Button className="w-full sm:w-auto">
              Go to Verification Page <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}