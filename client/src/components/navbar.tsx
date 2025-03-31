import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Bell, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Notification } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";
import { apiRequest } from "@/lib/queryClient";

export function Navbar() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();
  const { currency, currencySymbol } = useCurrency();
  const [, navigate] = useLocation();

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });
  
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/notifications/read', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    }
  });

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    const maxRetries = 5;
    let retryCount = 0;

    const connectWebSocket = () => {
      if (isConnecting || socket?.readyState === WebSocket.OPEN) return;

      setIsConnecting(true);

      try {
        // Construct WebSocket URL using window.location
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/ws`;  // Changed from '/ws' to '/api/ws'
        console.log('Attempting WebSocket connection to:', wsUrl);

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('WebSocket connection established');
          setIsConnecting(false);
          retryCount = 0;
          setSocket(ws);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
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
          setSocket(null);

          if (retryCount < maxRetries) {
            retryCount++;
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
            reconnectTimeout = setTimeout(connectWebSocket, delay);
          } else {
            toast({
              title: "Connection Error",
              description: "Failed to connect to notification service. Please refresh the page.",
              variant: "destructive",
            });
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket connection error:', error);
          setIsConnecting(false);
          ws.close();
        };
      } catch (error) {
        setIsConnecting(false);
        console.error('Failed to create WebSocket connection:', error);
      }
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (socket) {
        socket.close();
      }
    };
  }, []);

  useEffect(() => {
    if (notifications) {
      setUnreadCount(notifications.filter(n => !n.read).length);
    }
  }, [notifications]);

  return (
    <div className="bg-white shadow-sm border border-gray-100 rounded-md">
      <div className="flex justify-between items-center px-6 py-3 h-16">
        <div className="flex items-center gap-3">
          {/* Page Title - Dynamic based on current route */}
          <h1 className="text-lg font-medium text-gray-800">
            Dashboard
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Currency Selector */}
          <Link href="/profile">
            <Button variant="outline" className="flex items-center gap-2 rounded-full h-9 border-gray-200 hover:bg-gray-50">
              <Coins className="h-4 w-4 text-primary" />
              <span className="font-semibold text-gray-700">{currencySymbol}</span>
              <span className="text-xs text-gray-500">{currency}</span>
            </Button>
          </Link>
          
          {/* Notification Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="relative rounded-full h-9 w-9 p-0 border-gray-200 hover:bg-gray-50">
                <Bell className={cn("h-5 w-5 text-gray-700", isConnecting && "animate-pulse")} />
                {unreadCount > 0 && (
                  <Badge
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-primary border-2 border-white text-white"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden rounded-lg border shadow-lg">
              <div className="bg-gradient-to-r from-primary/80 to-primary text-white p-4">
                <h3 className="font-bold text-white">Notifications</h3>
                <p className="text-xs text-white/90">
                  {unreadCount > 0 
                    ? `You have ${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}`
                    : 'You\'re all caught up!'}
                </p>
              </div>
              <DropdownMenuSeparator className="m-0" />
              <div className="max-h-80 overflow-auto py-2">
                {notifications?.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="mb-2 rounded-full bg-gray-100 w-12 h-12 mx-auto flex items-center justify-center">
                      <Bell className="h-6 w-6 text-gray-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">No notifications</p>
                    <p className="text-xs text-gray-500 mt-1">You're all caught up!</p>
                  </div>
                ) : (
                  notifications?.map((notification) => {
                    // Check notification type
                    const isStoreNotification = notification.type === 'store_created';
                    const isReceiptNotification = notification.type === 'receipt_created';
                    const isClickable = isStoreNotification || isReceiptNotification;
                    
                    // Extract metadata from notification message
                    let itemName = null;
                    let storeId = null;
                    let receiptId = null;
                    
                    // Check if the message contains metadata
                    const messageParts = notification.message.split('|');
                    const displayMessage = messageParts[0]; // The actual message part
                    
                    // Extract name from the display message
                    const match = displayMessage.match(/"([^"]+)"/);
                    if (match && match[1]) {
                      itemName = match[1];
                    }
                    
                    // If we have metadata in JSON format
                    if (messageParts.length > 1) {
                      try {
                        const metadata = JSON.parse(messageParts[1]);
                        if (metadata.storeId) {
                          storeId = metadata.storeId;
                        }
                        if (metadata.receiptId) {
                          receiptId = metadata.receiptId;
                        }
                      } catch (error) {
                        console.error('Failed to parse notification metadata:', error);
                      }
                    }
                    
                    const handleClick = () => {
                      if (!isClickable) return;
                      
                      // Mark notification as read
                      markAsReadMutation.mutate();
                      
                      // Navigate based on notification type
                      if (isStoreNotification && storeId) {
                        navigate(`/stores/${storeId}`);
                      } else if (isReceiptNotification && receiptId) {
                        navigate(`/receipts/${receiptId}`);
                      } else if (isStoreNotification) {
                        navigate('/stores');
                      } else if (isReceiptNotification) {
                        navigate('/receipts');
                      }
                      
                      // Close dropdown by clicking outside
                      document.body.click();
                    };
                    
                    // Determine notification title and action text
                    let notificationTitle = notification.type;
                    let actionText = '';
                    
                    if (isStoreNotification) {
                      notificationTitle = 'New Store';
                      actionText = 'Click to view store details';
                    } else if (isReceiptNotification) {
                      notificationTitle = 'New Receipt';
                      actionText = 'Click to view receipt details';
                    }
                    
                    return (
                      <DropdownMenuItem 
                        key={notification.id} 
                        className={cn(
                          "flex flex-col items-start gap-1 p-3 border-b border-gray-100 last:border-0",
                          !notification.read && "bg-primary/5",
                          isClickable ? "cursor-pointer hover:bg-gray-50" : "cursor-default"
                        )}
                        onClick={handleClick}
                      >
                        <div className="flex w-full items-center mb-1">
                          <span className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${notification.read ? 'bg-gray-300' : 'bg-primary'}`}></span>
                          <div className="font-medium text-sm flex-1 text-gray-800">
                            {notificationTitle}
                          </div>
                          <div className="text-xs text-gray-500 flex-shrink-0">
                            {new Date(notification.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 pl-4">
                          {isClickable ? (
                            <div className="flex flex-col">
                              <span>
                                {/* Display only the message part without metadata */}
                                {displayMessage}
                              </span>
                              {!notification.read && (
                                <div className="mt-1 flex items-center text-xs text-primary font-medium">
                                  <span className="inline-block mr-1">→</span> {actionText}
                                </div>
                              )}
                            </div>
                          ) : (
                            notification.message
                          )}
                        </div>
                      </DropdownMenuItem>
                    );
                  })
                )}
              </div>
              {notifications && notifications.length > 0 && (
                <div className="p-3 bg-gray-50 border-t border-gray-100">
                  <Button 
                    className="w-full text-xs" 
                    variant={unreadCount > 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (unreadCount > 0) {
                        markAsReadMutation.mutate();
                        toast({
                          title: "Notifications marked as read",
                          description: `${unreadCount} ${unreadCount === 1 ? 'notification' : 'notifications'} marked as read`,
                          variant: "default",
                        });
                      }
                    }}
                    disabled={markAsReadMutation.isPending || unreadCount === 0}
                  >
                    {markAsReadMutation.isPending ? (
                      <span className="inline-flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Marking as read...
                      </span>
                    ) : unreadCount > 0 ? (
                      "Mark All as Read"
                    ) : (
                      "All caught up!"
                    )}
                  </Button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}