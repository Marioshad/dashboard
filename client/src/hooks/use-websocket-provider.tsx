import { createContext, ReactNode, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

// Helper function to check if user is likely authenticated (exists outside component)
function checkAuthenticated(): boolean {
  return document.cookie.includes('connect.sid');
}

interface WebSocketMessage {
  type: string;
  data: any;
}

interface WebSocketContextType {
  socket: WebSocket | null;
  isConnecting: boolean;
  isConnected: boolean;
  sendMessage: (message: WebSocketMessage) => boolean;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  
  // Track authentication failures to prevent excessive reconnect attempts
  const [authFailureCount, setAuthFailureCount] = useState(0);
  const [lastAuthAttempt, setLastAuthAttempt] = useState(0);
  const MAX_AUTH_FAILURES = 3;
  const AUTH_FAILURE_BACKOFF_MS = 10000; // 10 seconds after 3 failures

  // Function to send a message through the websocket
  const sendMessage = useCallback((message: WebSocketMessage): boolean => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, [socket]);

  // Create a WebSocket connection
  const connect = useCallback(() => {
    // Don't connect if already connecting or connected
    if (isConnecting || (socket && socket.readyState === WebSocket.OPEN)) return;
    
    // Don't attempt connection if likely not authenticated
    if (!checkAuthenticated()) {
      console.log('Not attempting WebSocket connection - user likely not authenticated');
      return;
    }
    
    // Close any existing socket before creating a new one
    if (socket) {
      try {
        socket.close();
      } catch (err) {
        console.error('Error closing existing socket:', err);
      }
    }
    
    setIsConnecting(true);
    
    try {
      // Get the current window location information
      const currentUrl = window.location.href;
      console.log('Current window location:', currentUrl);
      
      // Base the WebSocket URL on our current location
      let wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      let wsHost = window.location.host;
      
      // Handle Replit/Railway deployments which might have different URL patterns
      if (!wsHost || wsHost === 'localhost:undefined') {
        // Extract host from current URL if window.location.host fails
        const urlObj = new URL(currentUrl);
        wsHost = urlObj.host;
        console.log('Extracted host from URL:', wsHost);
      }
      
      // Create a WebSocket URL with session cookie value as a query parameter
      // This approach is needed because WebSockets don't automatically send cookies
      let sessionId = '';
      const cookieString = document.cookie;
      console.log('Current cookies:', cookieString);
      
      // Extract the connect.sid cookie value
      const cookieMatch = cookieString.match(/connect\.sid=([^;]+)/);
      if (cookieMatch && cookieMatch[1]) {
        sessionId = cookieMatch[1];
        console.log('Found session ID in cookies');
      } else {
        console.log('No session ID found in cookies');
      }
      
      // Add the session cookie value as a query parameter 
      const wsUrl = `${wsProtocol}//${wsHost}/api/ws?sid=${encodeURIComponent(sessionId)}`;
      console.log('Final WebSocket URL:', wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnecting(false);
        setIsConnected(true);
        setSocket(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          
          // Handle new notification created
          if (data.type === 'notification') {
            // Check if it's an unread count update notification
            if (data.data && data.data.type === 'unread_count_update') {
              // We can update without a full refetch, but for simplicity we'll invalidate
              console.log('Received unread count update:', data.data.unreadCount);
            }
            
            // Always invalidate notifications query for any notification update
            queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
          }
          
          // Handle receipt scan usage updates
          if (data.type === 'scan_usage_update') {
            console.log('Received scan usage update:', data.data);
            // Invalidate the user data to update the UI with new scan usage count
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            
            // If we're on the receipts page, we could show a toast notification
            const currentPath = window.location.pathname;
            if (currentPath.includes('/receipts')) {
              toast({
                title: "Receipt Scan Used",
                description: `You have ${data.data.scansRemaining} receipt scans remaining.`,
                duration: 3000,
              });
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket connection closed', event);
        setIsConnecting(false);
        setIsConnected(false);
        setSocket(null);
        
        // Special handling for auth failures to prevent excessive reconnection
        if (event.code === 1008 && event.reason === 'Not authenticated') {
          console.log('Authentication failure detected, not attempting immediate reconnect');
          setAuthFailureCount(prev => prev + 1);
          setLastAuthAttempt(Date.now());
          return; // Don't reconnect - our auth failure handler will manage this
        }
        
        // For other failures, auto-reconnect only if this wasn't a clean close
        // and we don't have excessive auth failures
        if (!event.wasClean && authFailureCount < MAX_AUTH_FAILURES) {
          setTimeout(() => {
            // Only attempt reconnect if document is visible and we're likely authenticated
            if (document.visibilityState === 'visible' && checkAuthenticated()) {
              connect();
            }
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnecting(false);
        setIsConnected(false);
        
        // Don't call ws.close() here as it will be called automatically when connection fails
        // and would result in "WebSocket is already in CLOSING or CLOSED state" errors
      };
    } catch (error) {
      setIsConnecting(false);
      setIsConnected(false);
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [isConnecting, socket, toast, authFailureCount]);

  // Connect on component mount and handle reconnection with backoff
  useEffect(() => {
    const attemptConnection = () => {
      // Check if we're authenticated
      if (!checkAuthenticated()) return;
    
      // Only attempt connection if we have no excessive failures  
      const currentTime = Date.now();
      const shouldAttemptConnect = 
        authFailureCount < MAX_AUTH_FAILURES || 
        (currentTime - lastAuthAttempt) > AUTH_FAILURE_BACKOFF_MS * Math.min(authFailureCount, 5);
    
      if (shouldAttemptConnect) {
        connect();
        setLastAuthAttempt(currentTime);
      }
    };
    
    // Try to connect on component mount
    attemptConnection();
    
    // Set up reconnection on tab visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        attemptConnection();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (socket) {
        // Attempt a clean close
        try {
          socket.close(1000, "Application closing");
        } catch (err) {
          console.error('Error closing socket during cleanup:', err);
        }
      }
    };
  }, [connect, isConnected, authFailureCount, lastAuthAttempt]);

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        isConnecting,
        isConnected,
        sendMessage
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}