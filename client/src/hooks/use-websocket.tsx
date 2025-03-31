import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface WebSocketMessage {
  type: string;
  data: any;
}

export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (isConnecting || socket?.readyState === WebSocket.OPEN) return;
    
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
          
          // Handle notification updates
          if (data.type === 'notification') {
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

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnecting(false);
        setIsConnected(false);
        setSocket(null);
        
        // Auto-reconnect after a delay
        setTimeout(() => {
          if (document.visibilityState === 'visible') {
            connect();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnecting(false);
        setIsConnected(false);
        ws.close();
      };
    } catch (error) {
      setIsConnecting(false);
      setIsConnected(false);
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [isConnecting, socket]);

  // Connect on component mount
  useEffect(() => {
    connect();
    
    // Add visibility change listener to reconnect when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        connect();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (socket) {
        socket.close();
      }
    };
  }, [connect, isConnected]);

  return {
    socket,
    isConnecting,
    isConnected
  };
}