import React, { useState, useEffect } from 'react';
import { Mail, XCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useEmailVerification } from '@/hooks/use-email-verification';

interface EmailVerificationBannerProps {
  actionRequired?: string; // Custom message about what action requires verification
  showIfVerified?: boolean; // Whether to show banner even if verified (as success)
}

/**
 * Banner component that shows email verification status and actions
 * Can be placed at the top of pages that require email verification
 */
export function EmailVerificationBanner({ 
  actionRequired, 
  showIfVerified = false 
}: EmailVerificationBannerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { showVerificationDialog, isEmailVerified } = useEmailVerification();
  const [isResending, setIsResending] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  
  // Poll for user status to ensure we have the latest verification status
  const [lastChecked, setLastChecked] = useState(Date.now());
  
  // Refresh status every few seconds to catch verification updates
  useEffect(() => {
    const checkInterval = 10000; // 10 seconds
    const intervalId = setInterval(() => {
      // Update lastChecked to trigger a re-render with latest user data
      setLastChecked(Date.now());
    }, checkInterval);
    
    return () => clearInterval(intervalId);
  }, []);

  // Don't show if not logged in or if already dismissed (unless we want to show verified success)
  if (!user || (dismissed && !showIfVerified)) return null;

  // Check if user's email is verified - use the context value which is updated by WebSocket events
  const isVerified = isEmailVerified || user.emailVerified;
  
  // Don't show if verified unless showIfVerified is true
  if (isVerified && !showIfVerified) return null;

  const handleResendVerification = async () => {
    try {
      setIsResending(true);
      const response = await apiRequest('/api/email/resend-verification', {
        method: 'POST'
      });
      
      toast({
        title: 'Verification Email Sent',
        description: 'Please check your inbox for the verification link.',
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: 'Failed to send verification email',
        description: 'Please try again later or contact support.',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleOpenDialog = () => {
    showVerificationDialog();
  };

  if (isVerified && showIfVerified) {
    return (
      <Alert className="mb-4 border-green-500 bg-green-50 dark:bg-green-950 dark:border-green-900">
        <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-800 dark:text-green-300">Email Verified</AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-400">
          Your email has been verified. You have full access to all features.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4 border-amber-500 bg-amber-50 dark:bg-amber-950 dark:border-amber-900">
      <div className="flex items-start justify-between w-full">
        <div className="flex items-start gap-3">
          <Mail className="h-4 w-4 mt-1 text-amber-600 dark:text-amber-400" />
          <div>
            <AlertTitle className="text-amber-800 dark:text-amber-300">
              Email Verification Required
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              {actionRequired || 'You need to verify your email address to access all features.'}{' '}
              <div className="mt-2 text-sm">
                <span className="font-medium">Without verification, you cannot:</span>
                <ul className="list-disc list-inside mt-1 ml-2">
                  <li>Add or edit items in your pantry</li>
                  <li>Create new locations or stores</li>
                  <li>Upload and process receipts</li>
                  <li>Use any premium features</li>
                </ul>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResendVerification}
                  disabled={isResending}
                >
                  {isResending ? 'Sending...' : 'Resend Verification Email'}
                </Button>
              </div>
            </AlertDescription>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900"
          onClick={() => setDismissed(true)}
        >
          <XCircle className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </Alert>
  );
}