import { useState } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

interface Location {
  id: number;
  name: string;
  type: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

interface FoodItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  locationId: number;
  expiryDate: string;
  price?: number;
  userId: number;
  purchased: string;
  createdAt: string;
  updatedAt: string;
}

export function FoodTrackerTest() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [newLocation, setNewLocation] = useState({ name: '', type: 'home' });
  const [newFoodItem, setNewFoodItem] = useState({
    name: '',
    quantity: 1,
    unit: 'pieces',
    locationId: 0,
    expiryDate: '',
    price: 0
  });
  const [loading, setLoading] = useState(false);

  // Test locations API
  const fetchLocations = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/locations', { method: 'GET' }) as Location[];
      setLocations(data);
      toast({
        title: 'Success',
        description: `Retrieved ${data.length} locations`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch locations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createLocation = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/locations', {
        method: 'POST',
        body: JSON.stringify(newLocation),
        headers: {
          'Content-Type': 'application/json',
        },
      }) as Location;
      
      toast({
        title: 'Success',
        description: `Created location: ${data.name}`,
      });
      
      // Refresh locations and reset form
      await fetchLocations();
      setNewLocation({ name: '', type: 'home' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create location',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Test food items API
  const fetchFoodItems = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/food-items', { method: 'GET' }) as FoodItem[];
      setFoodItems(data);
      toast({
        title: 'Success',
        description: `Retrieved ${data.length} food items`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch food items',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createFoodItem = async () => {
    if (!newFoodItem.locationId) {
      toast({
        title: 'Error',
        description: 'Please select a location',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const data = await apiRequest('/api/food-items', {
        method: 'POST',
        body: JSON.stringify(newFoodItem),
        headers: {
          'Content-Type': 'application/json',
        },
      }) as FoodItem;
      
      toast({
        title: 'Success',
        description: `Added food item: ${data.name}`,
      });
      
      // Refresh food items and reset form
      await fetchFoodItems();
      setNewFoodItem({
        name: '',
        quantity: 1,
        unit: 'pieces',
        locationId: newFoodItem.locationId, // Keep the location selected
        expiryDate: '',
        price: 0
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create food item',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-bold">Food Tracker API Testing</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Locations API Testing */}
        <Card>
          <CardHeader>
            <CardTitle>Locations API</CardTitle>
            <CardDescription>Test creating and fetching locations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Button onClick={fetchLocations} disabled={loading}>
                Fetch Locations
              </Button>
              
              {locations.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium">Locations:</h3>
                  <ul className="mt-2 space-y-2 border rounded-md p-2">
                    {locations.map(location => (
                      <li key={location.id} className="flex justify-between border-b pb-2">
                        <span>{location.name}</span>
                        <span className="text-muted-foreground">{location.type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="space-y-2 pt-4 border-t">
              <h3 className="font-medium">Add New Location</h3>
              <div className="grid gap-2">
                <Label htmlFor="locationName">Name</Label>
                <Input
                  id="locationName"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                  placeholder="e.g. Kitchen, Pantry"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="locationType">Type</Label>
                <select
                  id="locationType"
                  value={newLocation.type}
                  onChange={(e) => setNewLocation({ ...newLocation, type: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                >
                  <option value="home">Home</option>
                  <option value="work">Work</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={createLocation} disabled={loading || !newLocation.name}>
              Create Location
            </Button>
          </CardFooter>
        </Card>
        
        {/* Food Items API Testing */}
        <Card>
          <CardHeader>
            <CardTitle>Food Items API</CardTitle>
            <CardDescription>Test creating and fetching food items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Button onClick={fetchFoodItems} disabled={loading}>
                Fetch Food Items
              </Button>
              
              {foodItems.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium">Food Items:</h3>
                  <ul className="mt-2 space-y-2 border rounded-md p-2">
                    {foodItems.map(item => (
                      <li key={item.id} className="flex justify-between border-b pb-2">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            {item.quantity} {item.unit}
                          </span>
                        </div>
                        <span className="text-sm">Expires: {new Date(item.expiryDate).toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="space-y-2 pt-4 border-t">
              <h3 className="font-medium">Add New Food Item</h3>
              
              <div className="grid gap-2">
                <Label htmlFor="foodName">Name</Label>
                <Input
                  id="foodName"
                  value={newFoodItem.name}
                  onChange={(e) => setNewFoodItem({ ...newFoodItem, name: e.target.value })}
                  placeholder="e.g. Milk, Bread"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={newFoodItem.quantity}
                    onChange={(e) => setNewFoodItem({ ...newFoodItem, quantity: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <select
                    id="unit"
                    value={newFoodItem.unit}
                    onChange={(e) => setNewFoodItem({ ...newFoodItem, unit: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                  >
                    <option value="pieces">Pieces</option>
                    <option value="grams">Grams</option>
                    <option value="kg">Kilograms</option>
                    <option value="liters">Liters</option>
                    <option value="ml">Milliliters</option>
                  </select>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={newFoodItem.expiryDate}
                  onChange={(e) => setNewFoodItem({ ...newFoodItem, expiryDate: e.target.value })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <select
                  id="location"
                  value={newFoodItem.locationId}
                  onChange={(e) => setNewFoodItem({ ...newFoodItem, locationId: parseInt(e.target.value) })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                >
                  <option value="0">Select a location</option>
                  {locations.map(location => (
                    <option key={location.id} value={location.id}>
                      {location.name} ({location.type})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="price">Price (cents)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  value={newFoodItem.price}
                  onChange={(e) => setNewFoodItem({ ...newFoodItem, price: parseInt(e.target.value) })}
                  placeholder="Optional"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={createFoodItem} 
              disabled={loading || !newFoodItem.name || !newFoodItem.expiryDate || !newFoodItem.locationId}
            >
              Add Food Item
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}