import { useState, useEffect } from "react";
import { Link } from "wouter";
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
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Notification } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";

export function Navbar() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();
  const { currency, currencySymbol } = useCurrency();

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
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
    <div className="fruity-navbar-gradient">
      <div className="flex justify-between items-center px-4 h-full">
        <div className="flex items-center gap-3">
          {/* Page Title - Dynamic based on current route */}
          <h1 className="text-lg font-medium text-dark">
            Dashboard
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Currency Selector */}
          <Link href="/profile">
            <Button className="fruity-currency-button">
              <Coins className="h-4 w-4 mr-2" />
              <span className="font-semibold">{currencySymbol}</span>
              <span className="text-xs ml-1 opacity-70">{currency}</span>
            </Button>
          </Link>
          
          {/* Notification Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="relative fruity-notification-button">
                <Bell className={cn("h-5 w-5", isConnecting && "animate-pulse")} />
                {unreadCount > 0 && (
                  <Badge
                    className="fruity-notification-badge absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden rounded-xl border-0 shadow-xl">
              <div className="bg-primary-gradient text-white p-4">
                <h3 className="font-bold">Notifications</h3>
                <p className="text-xs opacity-80">You have {unreadCount} unread messages</p>
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
                  notifications?.map((notification) => (
                    <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-1 p-4 cursor-pointer hover:bg-gray-50">
                      <div className="flex w-full items-center mb-1">
                        <span className={`w-2 h-2 rounded-full mr-2 ${notification.read ? 'bg-gray-300' : 'bg-primary'}`}></span>
                        <div className="font-medium text-sm flex-1">{notification.type}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 pl-4">{notification.message}</div>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
              {notifications && notifications.length > 0 && (
                <div className="p-3 border-t border-gray-100">
                  <Button className="w-full text-xs" variant="outline" size="sm">
                    View All Notifications
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