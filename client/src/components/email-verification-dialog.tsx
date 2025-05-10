import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EmailVerificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  details?: {
    title?: string;
    description?: string;
    actionText?: string;
    actionPath?: string;
    resendPath?: string;
  };
}

export function EmailVerificationDialog({
  isOpen,
  onClose,
  details
}: EmailVerificationDialogProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isResending, setIsResending] = React.useState(false);

  const title = details?.title || 'Email Verification Required';
  const description = details?.description || 
    'You need to verify your email address before you can add or modify content. Please check your inbox for a verification email or request a new one.';
  const actionText = details?.actionText || 'Go to Profile';
  const actionPath = details?.actionPath || '/profile';
  const resendPath = details?.resendPath || '/api/email/resend-verification';

  const handleResendVerification = async () => {
    try {
      setIsResending(true);
      await apiRequest(resendPath, { method: 'POST' });
      toast({
        title: "Verification Email Sent",
        description: "Please check your inbox for the verification link.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Could not send verification email",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleActionClick = () => {
    onClose();
    navigate(actionPath);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <div className="flex flex-col gap-2 w-full">
            <Button 
              onClick={handleResendVerification} 
              variant="outline"
              disabled={isResending}
              className="w-full"
            >
              {isResending ? "Sending..." : "Resend Verification Email"}
            </Button>
            <Button 
              onClick={handleActionClick} 
              className="w-full"
            >
              {actionText} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <AlertDialogCancel asChild>
            <Button variant="ghost" className="w-full mt-2">Close</Button>
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}