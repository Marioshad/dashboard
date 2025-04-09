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
        console.log("[EMAIL VERIFICATION] Starting verification with token:", token?.substring(0, 10) + "...");
        
        const response = await apiRequest("/api/email/verify", {
          method: "POST",
          body: JSON.stringify({ token }),
          headers: {
            "Content-Type": "application/json"
          }
        });
        
        console.log("[EMAIL VERIFICATION] Response status:", response.status, response.statusText);
        
        // For successful response (HTTP 200)
        if (response.ok) {
          try {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              const data = await response.json();
              console.log("[EMAIL VERIFICATION] Success response data:", data);
              
              setVerificationStatus('success');
              setMessage(data.message || 'Email verified successfully');
            } else {
              console.log("[EMAIL VERIFICATION] Response is not JSON, using default success message");
              setVerificationStatus('success');
              setMessage('Email verified successfully');
            }
            
            toast({
              title: "Email Verified",
              description: "Your email has been successfully verified.",
              variant: "default",
            });
          } catch (jsonError) {
            console.error("[EMAIL VERIFICATION] Error parsing JSON response:", jsonError);
            setVerificationStatus('success'); // Still consider it a success since response.ok is true
            setMessage('Email verified successfully');
            
            toast({
              title: "Email Verified",
              description: "Your email has been successfully verified.",
              variant: "default",
            });
          }
        } 
        // For error responses (HTTP 400 or 500)
        else {
          try {
            const contentType = response.headers.get("content-type");
            let errorMessage = 'Invalid or expired verification token';
            
            if (contentType && contentType.includes("application/json")) {
              try {
                const errorData = await response.json();
                console.error("[EMAIL VERIFICATION] Error response:", {
                  status: response.status,
                  statusText: response.statusText,
                  data: errorData
                });
                
                errorMessage = errorData.message || errorMessage;
              } catch (parseError) {
                console.error("[EMAIL VERIFICATION] Failed to parse error JSON:", parseError);
              }
            } else {
              console.error("[EMAIL VERIFICATION] Non-JSON error response:", {
                status: response.status,
                statusText: response.statusText,
                contentType
              });
            }
            
            setVerificationStatus('error');
            setMessage(errorMessage);
            
            toast({
              title: "Verification Failed",
              description: errorMessage,
              variant: "destructive",
            });
          } catch (errorHandlingError) {
            console.error("[EMAIL VERIFICATION] Error handling failed response:", errorHandlingError);
            setVerificationStatus('error');
            setMessage('An error occurred while verifying your email. Please try again later.');
            
            toast({
              title: "Verification Failed",
              description: "Could not verify your email. Please try again later.",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        // For network errors or parsing errors
        console.error("[EMAIL VERIFICATION] Exception caught:", error);
        
        setVerificationStatus('error');
        setMessage('An error occurred while verifying your email. Please try again later.');
        
        toast({
          title: "Verification Failed",
          description: "Could not verify your email. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsVerifying(false);
        console.log("[EMAIL VERIFICATION] Verification process completed with status:", verificationStatus);
      }
    };
    
    verifyEmail();
  }, [token, toast]);
  
  // Handle resending verification email
  const handleResendVerification = async () => {
    try {
      setIsResending(true);
      console.log("[EMAIL VERIFICATION] Attempting to resend verification email");
      
      const response = await apiRequest("/api/email/resend-verification", {
        method: "POST"
      });
      
      console.log("[EMAIL VERIFICATION] Resend response status:", response.status, response.statusText);
      
      if (response.ok) {
        try {
          const contentType = response.headers.get("content-type");
          let successMessage = "A new verification email has been sent to your email address.";
          
          if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            console.log("[EMAIL VERIFICATION] Resend success response:", data);
            successMessage = data.message || successMessage;
          } else {
            console.log("[EMAIL VERIFICATION] Resend response is not JSON, using default success message");
          }
          
          toast({
            title: "Verification Email Sent",
            description: successMessage,
            variant: "default",
          });
        } catch (jsonError) {
          console.error("[EMAIL VERIFICATION] Error parsing JSON response:", jsonError);
          
          toast({
            title: "Verification Email Sent",
            description: "A new verification email has been sent to your email address.",
            variant: "default",
          });
        }
      } else {
        try {
          const contentType = response.headers.get("content-type");
          let errorMessage = "Failed to send verification email. Please try again later.";
          
          if (contentType && contentType.includes("application/json")) {
            try {
              const errorData = await response.json();
              console.error("[EMAIL VERIFICATION] Resend error response:", {
                status: response.status,
                statusText: response.statusText,
                data: errorData
              });
              
              errorMessage = errorData.message || errorMessage;
            } catch (parseError) {
              console.error("[EMAIL VERIFICATION] Failed to parse error JSON:", parseError);
            }
          } else {
            console.error("[EMAIL VERIFICATION] Non-JSON error response:", {
              status: response.status,
              statusText: response.statusText,
              contentType
            });
          }
          
          toast({
            title: "Could not send verification email",
            description: errorMessage,
            variant: "destructive",
          });
        } catch (errorHandlingError) {
          console.error("[EMAIL VERIFICATION] Error handling failed response:", errorHandlingError);
          
          toast({
            title: "Could not send verification email",
            description: "An error occurred. Please try again later.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("[EMAIL VERIFICATION] Resend exception caught:", error);
      
      toast({
        title: "Error",
        description: "Could not resend verification email. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
      console.log("[EMAIL VERIFICATION] Resend verification process completed");
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