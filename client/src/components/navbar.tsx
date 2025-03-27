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
    <div className="fruity-navbar-gradient shadow-md z-10">
      <div className="flex h-16 items-center px-4">
        <nav className="flex-1">
          <Link href="/">
            <span className="text-2xl font-bold cursor-pointer text-white">FoodVault</span>
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/profile">
            <Button variant="ghost" size="sm" className="flex items-center gap-1 fruity-currency-button">
              <Coins className="h-4 w-4" />
              <span>{currencySymbol}</span>
              <span className="text-xs ml-1">{currency}</span>
            </Button>
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative fruity-notification-button">
                <Bell className={cn("h-5 w-5", isConnecting && "animate-pulse")} />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className={cn(
                      "absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs fruity-notification-badge",
                    )}
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-80 overflow-auto">
                {notifications?.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  notifications?.map((notification) => (
                    <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-1 p-4">
                      <div className="text-sm">{notification.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}