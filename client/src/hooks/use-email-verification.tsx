import { createContext, ReactNode, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { queryClient } from '@/lib/queryClient';
import { EmailVerificationDialog } from '@/components/email-verification-dialog';

// Define context types
interface EmailVerificationContextType {
  showVerificationDialog: (details?: any) => void;
  hideVerificationDialog: () => void;
  isEmailVerified: boolean;
  refreshVerificationStatus: () => void;
}

// Create the context with default values
const EmailVerificationContext = createContext<EmailVerificationContextType>({
  showVerificationDialog: () => {},
  hideVerificationDialog: () => {},
  isEmailVerified: false,
  refreshVerificationStatus: () => {},
});

// Provider component that will wrap the app
export function EmailVerificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [dialogDetails, setDialogDetails] = useState<any>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(user?.emailVerified || false);
  
  // Update verification status when user data changes
  useEffect(() => {
    if (user) {
      setIsEmailVerified(user.emailVerified || false);
    } else {
      setIsEmailVerified(false);
    }
  }, [user]);
  
  // Set up polling to check for verification status changes
  useEffect(() => {
    // Only poll if user exists and is not verified
    if (!user || user.emailVerified) return;
    
    console.log('Setting up email verification polling');
    
    // Refresh user data every 10 seconds to check verification status
    const intervalId = setInterval(() => {
      console.log('Polling for email verification status updates');
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    }, 10000); // 10 seconds
    
    return () => {
      clearInterval(intervalId);
    };
  }, [user]);
  
  // Setup global error handler to catch email verification errors
  useEffect(() => {
    // Original error handler
    const originalOnError = window.onerror;
    
    // Custom error handler for API responses
    const handleApiError = function(this: Window, 
                                  event: Event | string, 
                                  source?: string, 
                                  lineno?: number, 
                                  colno?: number, 
                                  error?: Error) {
      // Check if this is a fetch response error
      if (error && error.name === 'EmailVerificationError') {
        // Show the verification dialog with details from the error
        // @ts-ignore
        showVerificationDialog(error.errorData?.details);
        
        // Prevent default error handling
        if (event instanceof Event) {
          event.preventDefault();
        }
        return true;
      }
      
      // Call the original handler for other errors
      if (originalOnError) {
        return originalOnError.apply(this, [event, source, lineno, colno, error]);
      }
      return false;
    };
    
    // Replace window.onerror with our custom handler
    window.onerror = handleApiError;
    
    // Add unhandled rejection handler for promise errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && event.reason.name === 'EmailVerificationError') {
        showVerificationDialog(event.reason.errorData?.details);
        event.preventDefault();
      }
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    // Cleanup
    return () => {
      window.onerror = originalOnError;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  
  // Function to show the dialog
  const showVerificationDialog = (details?: any) => {
    setDialogDetails(details || null);
    setIsOpen(true);
  };
  
  // Function to hide the dialog
  const hideVerificationDialog = () => {
    setIsOpen(false);
  };
  
  // Function to manually refresh verification status
  const refreshVerificationStatus = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  };
  
  return (
    <EmailVerificationContext.Provider
      value={{
        showVerificationDialog,
        hideVerificationDialog,
        isEmailVerified,
        refreshVerificationStatus,
      }}
    >
      {children}
      <EmailVerificationDialog
        isOpen={isOpen}
        onClose={hideVerificationDialog}
        details={dialogDetails}
      />
    </EmailVerificationContext.Provider>
  );
}

// Custom hook to use the context
export function useEmailVerification() {
  const context = useContext(EmailVerificationContext);
  if (!context) {
    throw new Error('useEmailVerification must be used within an EmailVerificationProvider');
  }
  return context;
}