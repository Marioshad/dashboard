import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { apiRequest } from "@/lib/queryClient";
import { FoodItem, Location } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Search,
  ShoppingCart,
  CalendarClock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isAfter, addDays, isBefore, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";

export default function ExpiryTrackerPage() {
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  // Fetch food items
  const { data: foodItems = [], isLoading } = useQuery<FoodItem[]>({
    queryKey: ["/api/food-items"],
    queryFn: async () => {
      return await apiRequest("/api/food-items") as FoodItem[];
    },
  });
  
  // Fetch locations
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
    queryFn: async () => {
      return await apiRequest("/api/locations") as Location[];
    },
  });
  
  // Filter food items by expiry date status
  const today = new Date();
  const threeDaysLater = addDays(today, 3);
  const sevenDaysLater = addDays(today, 7);
  const thirtyDaysLater = addDays(today, 30);
  
  const expiredItems = foodItems.filter(item => 
    isBefore(parseISO(item.expiryDate), today)
  );
  
  const expiringItems = foodItems.filter(item => {
    const expiryDate = parseISO(item.expiryDate);
    return isAfter(expiryDate, today) && isBefore(expiryDate, threeDaysLater);
  });
  
  const weekItems = foodItems.filter(item => {
    const expiryDate = parseISO(item.expiryDate);
    return isAfter(expiryDate, threeDaysLater) && isBefore(expiryDate, sevenDaysLater);
  });
  
  const monthItems = foodItems.filter(item => {
    const expiryDate = parseISO(item.expiryDate);
    return isAfter(expiryDate, sevenDaysLater) && isBefore(expiryDate, thirtyDaysLater);
  });
  
  const goodItems = foodItems.filter(item => 
    isAfter(parseISO(item.expiryDate), thirtyDaysLater)
  );
  
  // Get current items based on active tab
  const getCurrentItems = () => {
    switch (activeTab) {
      case "expired":
        return expiredItems;
      case "expiring":
        return expiringItems;
      case "week":
        return weekItems;
      case "month":
        return monthItems;
      case "good":
        return goodItems;
      default:
        return foodItems;
    }
  };
  
  // Filter by search query
  const filteredItems = getCurrentItems().filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Get location name by ID
  const getLocationName = (locationId: number) => {
    const location = locations.find(loc => loc.id === locationId);
    return location ? location.name : "Unknown";
  };
  
  // Get days until expiry
  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date();
    const expiry = parseISO(expiryDate);
    return differenceInDays(expiry, today);
  };
  
  // Get expiry status badge
  const getExpiryBadge = (expiryDate: string) => {
    const daysUntil = getDaysUntilExpiry(expiryDate);
    
    if (daysUntil < 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Expired
        </Badge>
      );
    }
    
    if (daysUntil <= 3) {
      return (
        <Badge variant="outline" className="gap-1 bg-amber-500 text-white border-amber-500">
          <AlertTriangle className="h-3 w-3" /> {daysUntil} {daysUntil === 1 ? 'day' : 'days'} left
        </Badge>
      );
    }
    
    if (daysUntil <= 7) {
      return (
        <Badge variant="outline" className="gap-1 border-amber-400 text-amber-600">
          <Clock className="h-3 w-3" /> {daysUntil} days left
        </Badge>
      );
    }
    
    if (daysUntil <= 30) {
      return (
        <Badge variant="outline" className="gap-1 border-blue-400 text-blue-600">
          <CalendarClock className="h-3 w-3" /> {daysUntil} days left
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="gap-1 border-green-400 text-green-600">
        <CheckCircle2 className="h-3 w-3" /> {daysUntil} days left
      </Badge>
    );
  };
  
  // Add to shopping list
  const addToShoppingList = async (item: FoodItem) => {
    try {
      // Check if "Shopping List" location exists
      let shoppingLocationId = locations.find(loc => loc.type === "shopping")?.id;
      
      // If not, create it
      if (!shoppingLocationId) {
        const newLocation = await apiRequest("/api/locations", {
          method: "POST",
          body: JSON.stringify({
            name: "Shopping List",
            type: "shopping",
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }) as Location;
        
        shoppingLocationId = newLocation.id;
      }
      
      // Add the item to shopping list
      await apiRequest("/api/food-items", {
        method: "POST",
        body: JSON.stringify({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          locationId: shoppingLocationId,
          expiryDate: format(addDays(new Date(), 30), "yyyy-MM-dd"), // Default expiry
          price: item.price,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      toast({
        title: "Added to shopping list",
        description: `${item.name} has been added to your shopping list.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add item to shopping list",
        variant: "destructive",
      });
    }
  };
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Expiry Tracker</h1>
            <p className="text-muted-foreground">
              Keep track of when your food items will expire
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Tabs 
            defaultValue="all" 
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full md:w-auto">
              <TabsTrigger value="all" className="relative">
                All
                <Badge className="ml-1 px-1.5">{foodItems.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="expired" className="relative text-destructive">
                Expired
                <Badge variant="destructive" className="ml-1 px-1.5">{expiredItems.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="expiring" className="relative">
                Soon
                <Badge variant="outline" className="ml-1 px-1.5 bg-amber-500 text-white border-amber-500">{expiringItems.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="week" className="relative">
                Week
                <Badge variant="outline" className="ml-1 px-1.5">{weekItems.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="month" className="relative">
                Month
                <Badge variant="outline" className="ml-1 px-1.5">{monthItems.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="good" className="relative">
                Good
                <Badge variant="outline" className="ml-1 px-1.5">{goodItems.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              className="pl-8 w-full sm:w-[250px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              {activeTab === "expired" ? "Expired Items" :
               activeTab === "expiring" ? "Expiring Soon" :
               activeTab === "week" ? "Expiring This Week" :
               activeTab === "month" ? "Expiring This Month" :
               activeTab === "good" ? "Items in Good Condition" :
               "All Food Items"}
            </CardTitle>
            <CardDescription>
              {filteredItems.length} items found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8">
                <CalendarClock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No items found</h3>
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? "Try a different search term" 
                    : activeTab === "all" 
                      ? "Add some food items to track their expiry dates" 
                      : `No items ${activeTab === "expired" ? "have expired" : `are expiring ${
                          activeTab === "expiring" ? "soon" : 
                          activeTab === "week" ? "this week" : 
                          activeTab === "month" ? "this month" : "in good condition"
                        }`}`
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[60vh]">
                <div className="space-y-3">
                  {filteredItems.map(item => (
                    <div 
                      key={item.id}
                      className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border rounded-lg p-3"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.quantity} {item.unit} · {getLocationName(item.locationId)}
                          {item.price ? ` · ${formatPrice(item.price)}` : ''}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            Expires: {format(parseISO(item.expiryDate), "PP")}
                          </span>
                          {getExpiryBadge(item.expiryDate)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => addToShoppingList(item)}
                        >
                          <ShoppingCart className="h-4 w-4 mr-1" />
                          Add to Shopping List
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}