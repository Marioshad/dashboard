import { createContext, ReactNode, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

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
  
  // Create a single websocket connection
  const connect = useCallback(() => {
    if (isConnecting || (socket && socket.readyState === WebSocket.OPEN)) return;
    
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
      
      // Create a clean WebSocket URL with no query parameters
      const wsUrl = `${wsProtocol}//${wsHost}/api/ws`;
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
        
        // Auto-reconnect after a delay, but only if this wasn't a clean close
        if (!event.wasClean) {
          setTimeout(() => {
            if (document.visibilityState === 'visible') {
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
  }, [isConnecting, socket, toast]);

  // Function to send a message through the websocket
  const sendMessage = useCallback((message: WebSocketMessage): boolean => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, [socket]);

  // Connect on component mount and handle reconnection
  useEffect(() => {
    connect();
    
    // Add visibility change listener to reconnect when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        connect();
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
  }, [connect, isConnected]);

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