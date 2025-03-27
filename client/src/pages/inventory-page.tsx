import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FoodItem, Location } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Refrigerator,
  Apple,
  Plus,
  Trash2,
  Edit,
  Calendar,
  Search,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { format, parseISO, isAfter, addDays, isBefore } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function InventoryPage() {
  const { toast } = useToast();
  const { formatPrice, currencySymbol } = useCurrency();
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<FoodItem | null>(null);
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: 1,
    unit: "pieces",
    locationId: 0,
    expiryDate: format(addDays(new Date(), 7), "yyyy-MM-dd"), // Default to a week from now
    price: 0,
    purchased: format(new Date(), "yyyy-MM-dd"), // Today's date
  });
  
  // Fetch locations
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
    queryFn: async () => {
      return await apiRequest("/api/locations") as Location[];
    },
  });
  
  // Fetch food items
  const {
    data: foodItems = [],
    isLoading,
    refetch,
  } = useQuery<FoodItem[]>({
    queryKey: ["/api/food-items", selectedLocation],
    queryFn: async () => {
      const endpoint = selectedLocation !== "all" && selectedLocation !== "0"
        ? `/api/food-items?locationId=${selectedLocation}`
        : "/api/food-items";
      return await apiRequest(endpoint) as FoodItem[];
    },
  });
  
  // Add new food item
  const addItemMutation = useMutation({
    mutationFn: async (item: typeof newItem) => {
      return await apiRequest("/api/food-items", {
        method: "POST",
        body: JSON.stringify(item),
        headers: {
          "Content-Type": "application/json",
        },
      }) as FoodItem;
    },
    onSuccess: () => {
      toast({
        title: "Item added",
        description: "Food item added to inventory successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/food-items"] });
      setOpenAddDialog(false);
      resetNewItemForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add food item",
        variant: "destructive",
      });
    },
  });
  
  // Update food item
  const updateItemMutation = useMutation({
    mutationFn: async (item: FoodItem) => {
      const { id, createdAt, updatedAt, userId, ...updateData } = item;
      return await apiRequest(`/api/food-items/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
        headers: {
          "Content-Type": "application/json",
        },
      }) as FoodItem;
    },
    onSuccess: () => {
      toast({
        title: "Item updated",
        description: "Food item updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/food-items"] });
      setOpenEditDialog(false);
      setItemToEdit(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update food item",
        variant: "destructive",
      });
    },
  });
  
  // Delete food item
  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/food-items/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Item deleted",
        description: "Food item removed from inventory",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/food-items"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete food item",
        variant: "destructive",
      });
    },
  });
  
  // Filter food items by search query
  const filteredItems = foodItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Reset new item form
  const resetNewItemForm = () => {
    setNewItem({
      name: "",
      quantity: 1,
      unit: "pieces",
      locationId: locations.length > 0 ? locations[0].id : 0,
      expiryDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      price: 0,
      purchased: format(new Date(), "yyyy-MM-dd"),
    });
  };
  
  // Open edit dialog with item data
  const handleEditItem = (item: FoodItem) => {
    setItemToEdit(item);
    setOpenEditDialog(true);
  };
  
  // Delete item with confirmation
  const handleDeleteItem = (id: number) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      deleteItemMutation.mutate(id);
    }
  };
  
  // Get location name by ID
  const getLocationName = (locationId: number) => {
    const location = locations.find(loc => loc.id === locationId);
    return location ? location.name : "Unknown";
  };
  
  // Check if item is expired or expiring soon
  const getExpiryStatus = (expiryDate: string) => {
    const today = new Date();
    const expiry = parseISO(expiryDate);
    
    if (isBefore(expiry, today)) {
      return { status: "expired", badge: "destructive" };
    }
    
    if (isBefore(expiry, addDays(today, 3))) {
      return { status: "expiring-soon", badge: "warning" };
    }
    
    return { status: "ok", badge: "default" };
  };
  
  // Initialize form when locations are loaded
  useEffect(() => {
    if (locations.length > 0 && newItem.locationId === 0) {
      setNewItem(prev => ({
        ...prev,
        locationId: locations[0].id
      }));
    }
  }, [locations]);
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Food Inventory</h1>
            <p className="text-muted-foreground">
              Manage your food items and track expiry dates
            </p>
          </div>
          <Button onClick={() => setOpenAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="location-filter">Filter by Location:</Label>
            <Select
              value={selectedLocation}
              onValueChange={setSelectedLocation}
            >
              <SelectTrigger id="location-filter" className="w-[180px]">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(location => (
                  <SelectItem key={location.id} value={location.id.toString()}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
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
              <Apple className="h-5 w-5 text-primary" />
              Food Items
            </CardTitle>
            <CardDescription>
              {filteredItems.length} items in your inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8">
                <Apple className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No food items found</h3>
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? "Try a different search term or clear the filter" 
                    : "Add your first food item to get started"}
                </p>
                {!searchQuery && (
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={() => setOpenAddDialog(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add First Item
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map(item => {
                      const expiryStatus = getExpiryStatus(item.expiryDate);
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell>{getLocationName(item.locationId)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{format(parseISO(item.expiryDate), "PP")}</span>
                              {expiryStatus.status !== "ok" && (
                                <Badge variant={expiryStatus.badge as any}>
                                  {expiryStatus.status === "expired" ? "Expired" : "Expiring Soon"}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.price ? formatPrice(item.price) : "N/A"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEditItem(item)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Add Food Item Dialog */}
      <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Food Item</DialogTitle>
            <DialogDescription>
              Add a new item to your food inventory
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Item Name</Label>
              <Input
                id="name"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="e.g. Milk, Bread"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit</Label>
                <Select 
                  value={newItem.unit}
                  onValueChange={(value) => setNewItem({ ...newItem, unit: value })}
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pieces">Pieces</SelectItem>
                    <SelectItem value="grams">Grams</SelectItem>
                    <SelectItem value="kg">Kilograms</SelectItem>
                    <SelectItem value="liters">Liters</SelectItem>
                    <SelectItem value="ml">Milliliters</SelectItem>
                    <SelectItem value="oz">Ounces</SelectItem>
                    <SelectItem value="lb">Pounds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="location">Storage Location</Label>
              <Select 
                value={newItem.locationId.toString()}
                onValueChange={(value) => setNewItem({ ...newItem, locationId: parseInt(value) })}
              >
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.length === 0 ? (
                    <SelectItem value="0" disabled>No locations available</SelectItem>
                  ) : (
                    locations.map(location => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.name} ({location.type})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={newItem.expiryDate}
                  onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="purchased">Purchase Date</Label>
                <Input
                  id="purchased"
                  type="date"
                  value={newItem.purchased}
                  onChange={(e) => setNewItem({ ...newItem, purchased: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="price">Price (cents)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                value={newItem.price}
                onChange={(e) => setNewItem({ ...newItem, price: parseInt(e.target.value) })}
                placeholder="Optional"
              />
              <p className="text-sm text-muted-foreground">
                Enter price in cents (e.g. 299 for {formatPrice(299)})
                <br />Current currency: {currencySymbol}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => addItemMutation.mutate(newItem)}
              disabled={!newItem.name || !newItem.locationId || addItemMutation.isPending}
            >
              {addItemMutation.isPending ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Food Item Dialog */}
      {itemToEdit && (
        <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Food Item</DialogTitle>
              <DialogDescription>
                Update the details of your food item
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Item Name</Label>
                <Input
                  id="edit-name"
                  value={itemToEdit.name}
                  onChange={(e) => setItemToEdit({ ...itemToEdit, name: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-quantity">Quantity</Label>
                  <Input
                    id="edit-quantity"
                    type="number"
                    min="1"
                    value={itemToEdit.quantity}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, quantity: e.target.value })}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="edit-unit">Unit</Label>
                  <Select 
                    value={itemToEdit.unit}
                    onValueChange={(value) => setItemToEdit({ ...itemToEdit, unit: value })}
                  >
                    <SelectTrigger id="edit-unit">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pieces">Pieces</SelectItem>
                      <SelectItem value="grams">Grams</SelectItem>
                      <SelectItem value="kg">Kilograms</SelectItem>
                      <SelectItem value="liters">Liters</SelectItem>
                      <SelectItem value="ml">Milliliters</SelectItem>
                      <SelectItem value="oz">Ounces</SelectItem>
                      <SelectItem value="lb">Pounds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-location">Storage Location</Label>
                <Select 
                  value={itemToEdit.locationId.toString()}
                  onValueChange={(value) => setItemToEdit({ ...itemToEdit, locationId: parseInt(value) })}
                >
                  <SelectTrigger id="edit-location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(location => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.name} ({location.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-expiryDate">Expiry Date</Label>
                  <Input
                    id="edit-expiryDate"
                    type="date"
                    value={typeof itemToEdit.expiryDate === 'string'
                      ? format(parseISO(itemToEdit.expiryDate), "yyyy-MM-dd")
                      : format(itemToEdit.expiryDate, "yyyy-MM-dd")}
                    onChange={(e) => {
                      const dateValue = parseISO(e.target.value);
                      setItemToEdit({ ...itemToEdit, expiryDate: dateValue });
                    }}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="edit-purchased">Purchase Date</Label>
                  <Input
                    id="edit-purchased"
                    type="date"
                    value={typeof itemToEdit.purchased === 'string' 
                      ? format(parseISO(itemToEdit.purchased), "yyyy-MM-dd") 
                      : format(itemToEdit.purchased, "yyyy-MM-dd")}
                    onChange={(e) => {
                      const dateValue = parseISO(e.target.value);
                      setItemToEdit({ ...itemToEdit, purchased: dateValue });
                    }}
                  />
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-price">Price (cents)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  min="0"
                  value={itemToEdit.price || 0}
                  onChange={(e) => setItemToEdit({ ...itemToEdit, price: parseInt(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground">
                  Enter price in cents (e.g. 299 for {formatPrice(299)})
                  <br />Current currency: {currencySymbol}
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenEditDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => updateItemMutation.mutate(itemToEdit)}
                disabled={!itemToEdit.name || updateItemMutation.isPending}
              >
                {updateItemMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}