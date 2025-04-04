import React, { createContext, useContext, useState, useEffect } from 'react';
import { EmailVerificationDialog } from './email-verification-dialog';

// Define context types
interface EmailVerificationContextType {
  showVerificationDialog: (details?: any) => void;
  hideVerificationDialog: () => void;
}

// Create the context with default values
const EmailVerificationContext = createContext<EmailVerificationContextType>({
  showVerificationDialog: () => {},
  hideVerificationDialog: () => {},
});

// Custom hook to use the context
export const useEmailVerification = () => useContext(EmailVerificationContext);

// Provider component that will wrap the app
export function EmailVerificationProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [dialogDetails, setDialogDetails] = useState<any>(null);
  
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
  
  return (
    <EmailVerificationContext.Provider
      value={{
        showVerificationDialog,
        hideVerificationDialog,
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