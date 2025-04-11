import { createContext, ReactNode, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useQuery } from "@tanstack/react-query";

// Helper function to check if user has WebSocket token available
function hasWebSocketToken(userData: any): boolean {
  return !!(userData && userData._websocketToken);
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
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  // Socket state
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  
  // Refs to prevent infinite loops and track state between renders
  const socketRef = useRef<WebSocket | null>(null); 
  const hasInitiatedConnectionAttempt = useRef(false);
  const connectionAttemptCount = useRef(0);
  const reconnectionTimer = useRef<NodeJS.Timeout | null>(null);
  
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
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Clean up function to close WebSocket and clean state
  const cleanupSocket = useCallback(() => {
    // Clear any pending reconnection timer
    if (reconnectionTimer.current) {
      clearTimeout(reconnectionTimer.current);
      reconnectionTimer.current = null;
    }
    
    // Close the socket if it exists
    if (socketRef.current) {
      try {
        const currentSocket = socketRef.current;
        
        // Remove all event listeners to prevent memory leaks
        currentSocket.onopen = null;
        currentSocket.onclose = null;
        currentSocket.onerror = null;
        currentSocket.onmessage = null;
        
        // Close the socket with a normal closure code
        if (currentSocket.readyState === WebSocket.OPEN || 
            currentSocket.readyState === WebSocket.CONNECTING) {
          currentSocket.close(1000, "Normal closure");
        }
      } catch (error) {
        console.error("Error cleaning up socket:", error);
      }
      
      // Clear the socket reference
      socketRef.current = null;
    }
    
    // Reset state
    setSocket(null);
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  // Create a WebSocket connection
  const connect = useCallback(() => {
    // Don't connect if we're already connecting or connected
    if (isConnecting) {
      console.log('Already connecting, skipping additional connection attempt');
      return;
    }
    
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected, skipping connection attempt');
        return;
      } else if (socketRef.current.readyState === WebSocket.CONNECTING) {
        console.log('WebSocket already connecting, skipping duplicate connection attempt');
        return;
      }
    }
    
    // Don't try to connect if we don't have a token
    if (!userData || !(userData as any)._websocketToken) {
      console.log('No WebSocket token available, skipping connection attempt');
      return;
    }
    
    // Log attempt for debugging
    connectionAttemptCount.current += 1;
    console.log(`WebSocket connection attempt #${connectionAttemptCount.current}`);
    
    // Clean up any existing socket
    cleanupSocket();
    
    // Mark as connecting
    setIsConnecting(true);
    hasInitiatedConnectionAttempt.current = true; 
    
    // Extract token from user data
    const token = (userData as any)._websocketToken;
    
    // Determine WebSocket URL
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/api/ws?token=${encodeURIComponent(token)}`;
    
    try {
      // Create new WebSocket
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;
      
      ws.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnecting(false);
        setIsConnected(true);
        setSocket(ws);
        setAuthFailureCount(0); // Reset failure count on successful connection
      };
      
      ws.onmessage = (event) => {
        // Process message
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          
          // Handle notifications
          if (data.type === 'notification') {
            queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
          }
          
          // Handle receipt scan updates
          if (data.type === 'scan_usage_update') {
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            
            // Show toast if on receipts page
            if (window.location.pathname.includes('/receipts')) {
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
        console.log(`WebSocket closed with code ${event.code}`, event);
        
        // Reset socket state
        setIsConnecting(false);
        setIsConnected(false);
        setSocket(null);
        socketRef.current = null;
        
        // Handle authentication failures
        if (event.code === 1008 && event.reason === 'Not authenticated') {
          console.log('Authentication failure detected');
          setAuthFailureCount(prev => prev + 1);
          setLastAuthAttempt(Date.now());
          return; // Don't auto-reconnect on auth failures
        }
        
        // Only attempt automatic reconnection if:
        // 1. Not a clean closure (unexpected disconnect)
        // 2. Tab is visible
        // 3. We don't have too many auth failures
        // 4. We have the token available
        if (!event.wasClean && 
            document.visibilityState === 'visible' && 
            authFailureCount < MAX_AUTH_FAILURES &&
            hasWebSocketToken(userData)) {
          
          const backoffMs = Math.min(3000 * (1 + authFailureCount), 15000);
          console.log(`Scheduling reconnection in ${backoffMs}ms`);
          
          // Clear any existing reconnection timer
          if (reconnectionTimer.current) {
            clearTimeout(reconnectionTimer.current);
          }
          
          // Set new timer
          reconnectionTimer.current = setTimeout(() => {
            hasInitiatedConnectionAttempt.current = false; // Allow reconnection
            reconnectionTimer.current = null;
            connect();
          }, backoffMs);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnecting(false);
      setIsConnected(false);
      socketRef.current = null;
    }
  }, [userData, isConnecting, cleanupSocket, authFailureCount, toast]);

  // Safely reconnect - used for manual reconnection
  const reconnect = useCallback(() => {
    console.log('Manual reconnection requested');
    
    // Clean up existing socket
    cleanupSocket();
    
    // Reset flags
    hasInitiatedConnectionAttempt.current = false;
    
    // Attempt new connection after small delay
    setTimeout(() => {
      connect();
      
      toast({
        title: "Reconnecting...",
        description: "Attempting to reconnect to server",
        duration: 3000,
      });
    }, 300);
  }, [cleanupSocket, connect, toast]);

  // Initial connection attempt when userData becomes available
  useEffect(() => {
    // Only connect if:
    // 1. We have user data with a token
    // 2. We're not already connected
    // 3. We're not already connecting
    // 4. We haven't already initiated a connection attempt
    if (userData && 
        hasWebSocketToken(userData) && 
        !isConnected && 
        !isConnecting && 
        !socketRef.current && 
        !hasInitiatedConnectionAttempt.current) {
      
      console.log('User data available with token, initiating connection');
      connect();
    }
  }, [userData, isConnected, isConnecting, connect]);

  // Handle visibility changes (for reconnecting when tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 
          !isConnected && 
          !isConnecting && 
          !socketRef.current) {
        
        // Reset flag to allow connection when tab becomes visible
        hasInitiatedConnectionAttempt.current = false;
        
        if (hasWebSocketToken(userData)) {
          console.log('Page visible again, attempting reconnection');
          connect();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanupSocket();
    };
  }, [userData, isConnected, isConnecting, connect, cleanupSocket]);

  // Provide context
  return (
    <WebSocketContext.Provider
      value={{
        socket,
        isConnecting,
        isConnected,
        sendMessage,
        reconnect
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