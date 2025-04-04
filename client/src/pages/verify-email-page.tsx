import { useState, useEffect } from 'react';
import { useLocation, useRoute, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const [matched, params] = useRoute('/verify-email');
  const { user } = useAuth();
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userId = urlParams.get('userId');
    
    if (!token || !userId) {
      setIsVerifying(false);
      setError('Invalid verification link. Missing token or user ID.');
      return;
    }
    
    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/email/verify?token=${token}&userId=${userId}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
          setIsSuccess(true);
        } else {
          setError(data.message || 'Failed to verify email. The link may be expired or invalid.');
        }
      } catch (err) {
        setError('An error occurred while verifying your email. Please try again later.');
        console.error('Email verification error:', err);
      } finally {
        setIsVerifying(false);
      }
    };
    
    verifyEmail();
  }, []);
  
  const renderContent = () => {
    if (isVerifying) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-center text-lg">Verifying your email address...</p>
        </div>
      );
    }
    
    if (isSuccess) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
          <p className="text-center text-lg mb-6">Your email has been successfully verified!</p>
          <p className="text-center text-muted-foreground mb-6">
            You now have full access to all features of the application.
          </p>
          <Button onClick={() => setLocation('/')}>Go to Dashboard</Button>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <XCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-center text-lg mb-4">Verification Failed</p>
        
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        
        {user ? (
          <div className="space-y-4">
            <Button 
              variant="outline" 
              onClick={() => setLocation('/account')}
              className="mr-4"
            >
              Go to Account Settings
            </Button>
            <Button onClick={() => setLocation('/')}>Return to Dashboard</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-muted-foreground mb-4">
              If you need a new verification link, please log in to your account and request one from your profile settings.
            </p>
            <Button onClick={() => setLocation('/auth')}>Sign In</Button>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="container max-w-screen-lg mx-auto px-4 py-12">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>
            Verifying your email address provides full access to all features
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
        <CardFooter className="flex justify-center border-t pt-6">
          <p className="text-center text-sm text-muted-foreground">
            FoodVault - Track your food inventory efficiently
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}