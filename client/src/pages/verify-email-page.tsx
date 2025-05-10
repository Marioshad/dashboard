import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, Check, ArrowLeft, Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error' | null>(null);
  const [message, setMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  
  // Parse the verification token from the URL
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token');
  
  // Handle email verification with token
  useEffect(() => {
    if (!token) return;
    
    const verifyEmail = async () => {
      try {
        setIsVerifying(true);
        const response = await apiRequest("/api/email/verify", {
          method: "POST",
          body: JSON.stringify({ token }),
          headers: {
            "Content-Type": "application/json"
          }
        });
        const data = await response.json();
        
        setVerificationStatus(data.success ? 'success' : 'error');
        setMessage(data.message);
        
        if (data.success) {
          toast({
            title: "Email Verified",
            description: "Your email has been successfully verified.",
            variant: "default",
          });
        } else {
          toast({
            title: "Verification Failed",
            description: data.message,
            variant: "destructive",
          });
        }
      } catch (error) {
        setVerificationStatus('error');
        setMessage('An error occurred while verifying your email. Please try again later.');
        
        toast({
          title: "Verification Failed",
          description: "Could not verify your email. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsVerifying(false);
      }
    };
    
    verifyEmail();
  }, [token, toast]);
  
  // Handle resending verification email
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
  
  // Redirect to login if user is not authenticated
  if (!user) {
    navigate('/auth');
    return null;
  }
  
  // Already verified case - show success
  if (user.emailVerified && !token) {
    return (
      <div className="container max-w-md py-10">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto rounded-full bg-green-100 p-3 w-fit mb-2">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>Email Already Verified</CardTitle>
            <CardDescription>
              Your email address has already been verified.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-2">
            <p className="text-muted-foreground">
              You have full access to all features of the application.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              variant="default"
              className="w-full"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-md py-10">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit mb-2">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>
            {token ? (
              isVerifying ? "Verifying your email..." : 
              verificationStatus === 'success' ? "Email Verified" : 
              verificationStatus === 'error' ? "Verification Failed" : 
              "Email Verification"
            ) : (
              "Email Verification Required"
            )}
          </CardTitle>
          <CardDescription>
            {token ? (
              isVerifying ? "Please wait while we verify your email." : 
              verificationStatus === 'success' ? "Your email has been successfully verified." : 
              verificationStatus === 'error' ? message : 
              "Processing your verification request."
            ) : (
              "You need to verify your email address to use all features."
            )}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="text-center pb-6">
          {token ? (
            isVerifying ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p>Verifying your email address...</p>
              </div>
            ) : verificationStatus === 'success' ? (
              <div className="bg-green-50 p-4 rounded-md border border-green-100 text-left">
                <div className="flex items-start">
                  <Check className="h-5 w-5 mt-0.5 mr-2 text-green-500 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Email Verified Successfully</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Your email address ({user.email}) has been verified. You now have full access to all features.
                    </div>
                  </div>
                </div>
              </div>
            ) : verificationStatus === 'error' ? (
              <div className="bg-red-50 p-4 rounded-md border border-red-100 text-left">
                <p className="text-sm text-muted-foreground">
                  {message || "There was a problem verifying your email address. The verification link may be expired or invalid."}
                </p>
                <p className="text-sm font-medium mt-2">
                  You can request a new verification link below.
                </p>
              </div>
            ) : null
          ) : (
            <div className="bg-amber-50 p-4 rounded-md border border-amber-100 text-left">
              <p className="text-sm">
                We've sent a verification email to <span className="font-medium">{user.email}</span>.
                Please check your inbox and click the verification link.
              </p>
              <p className="text-sm mt-2">
                If you don't see the email, check your spam folder or request a new verification link below.
              </p>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col gap-2">
          {(verificationStatus === 'error' || !token) && (
            <Button
              variant="outline"
              onClick={handleResendVerification}
              disabled={isResending}
              className="w-full"
            >
              {isResending ? "Sending..." : "Resend Verification Email"}
            </Button>
          )}
          
          <Button
            variant={verificationStatus === 'success' ? "default" : "secondary"}
            className="w-full"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}