import { createContext, ReactNode, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useQuery } from "@tanstack/react-query";

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
  
  // Get the current user data which includes the WebSocket token
  const { data: userData } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
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

  // Get WebSocket token from user data or server
  const getWebSocketToken = useCallback(async () => {
    // First try to get token from user data (added in the /api/user endpoint)
    // Access _websocketToken with a type assertion to avoid TypeScript errors
    if (userData && (userData as any)._websocketToken) {
      console.log('Using WebSocket token from user data');
      return (userData as any)._websocketToken;
    }
    
    // Fallback to fetching the token directly
    try {
      console.log('Fetching WebSocket token from server...');
      const response = await fetch('/api/ws-token', {
        method: 'GET',
        credentials: 'include', // Important: include credentials (cookies) with the request
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('WebSocket token request failed:', response.status, response.statusText);
        return null;
      }
      
      const data = await response.json();
      console.log('Successfully retrieved WebSocket token');
      return data.token;
    } catch (error) {
      console.error('Error fetching WebSocket token:', error);
      return null;
    }
  }, [userData]);

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
    
    // Get the current window location information
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = window.location.host;
    
    // Fetch token or create fallback URL
    getWebSocketToken().then(token => {
      let wsUrl: string;
      
      if (token) {
        // Use token-based authentication
        console.log('Using token for WebSocket authentication:', token.substring(0, 20) + '...');
        wsUrl = `${wsProtocol}//${wsHost}/api/ws?token=${encodeURIComponent(token)}`;
      } else {
        // Fallback to cookie-based authentication
        let sessionId = '';
        const cookieMatch = document.cookie.match(/connect\.sid=([^;]+)/);
        if (cookieMatch && cookieMatch[1]) {
          sessionId = cookieMatch[1];
          console.log('Using session cookie for WebSocket authentication');
        } else {
          console.warn('No session cookie found for WebSocket authentication');
        }
        wsUrl = `${wsProtocol}//${wsHost}/api/ws?sid=${encodeURIComponent(sessionId)}`;
      }
      
      console.log('Connecting to WebSocket at:', wsUrl);
      
      try {
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
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setIsConnecting(false);
        setIsConnected(false);
      }
    }).catch(error => {
      console.error('Token fetch failed:', error);
      setIsConnecting(false);
      setIsConnected(false);
    });
  }, [isConnecting, socket, toast, authFailureCount, getWebSocketToken]);

  // Connect on component mount and handle reconnection with backoff
  useEffect(() => {
    const attemptConnection = () => {
      // Check if we're authenticated
      if (!checkAuthenticated()) {
        console.log('Not authenticated, skipping WebSocket connection attempt');
        return;
      }
      
      // Debug authentication token issues
      if (userData) {
        const hasToken = !!(userData as any)._websocketToken;
        console.log('User data available with WebSocket token:', hasToken);
        if (!hasToken) {
          console.warn('WebSocket token is missing from user data');
        }
      } else {
        console.warn('User data not available for WebSocket connection');
      }
    
      // Only attempt connection if we have no excessive failures  
      const currentTime = Date.now();
      const shouldAttemptConnect = 
        authFailureCount < MAX_AUTH_FAILURES || 
        (currentTime - lastAuthAttempt) > AUTH_FAILURE_BACKOFF_MS * Math.min(authFailureCount, 5);
    
      if (shouldAttemptConnect) {
        console.log('Attempting WebSocket connection');
        connect();
        setLastAuthAttempt(currentTime);
      } else {
        console.log('Skipping connection due to excessive failures');
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