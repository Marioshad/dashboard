import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Location, InsertLocation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Refrigerator,
  Plus,
  Trash2,
  Edit,
  Box,
  ShoppingBag,
  Home,
  Warehouse,
} from "lucide-react";

export default function LocationsPage() {
  const { toast } = useToast();
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [locationToEdit, setLocationToEdit] = useState<Location | null>(null);
  const [newLocation, setNewLocation] = useState<Partial<InsertLocation>>({
    name: "",
    type: "fridge",
  });
  
  // Fetch locations
  const {
    data: locations = [],
    isLoading,
    refetch,
  } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
    queryFn: async () => {
      return await apiRequest("/api/locations") as Location[];
    },
  });
  
  // Add new location
  const addLocationMutation = useMutation({
    mutationFn: async (location: typeof newLocation) => {
      return await apiRequest("/api/locations", {
        method: "POST",
        body: JSON.stringify(location),
        headers: {
          "Content-Type": "application/json",
        },
      }) as Location;
    },
    onSuccess: () => {
      toast({
        title: "Location added",
        description: "Storage location added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setOpenAddDialog(false);
      resetNewLocationForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add location",
        variant: "destructive",
      });
    },
  });
  
  // Update location
  const updateLocationMutation = useMutation({
    mutationFn: async (location: Location) => {
      const { id, userId, createdAt, updatedAt, ...updateData } = location;
      return await apiRequest(`/api/locations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
        headers: {
          "Content-Type": "application/json",
        },
      }) as Location;
    },
    onSuccess: () => {
      toast({
        title: "Location updated",
        description: "Storage location updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setOpenEditDialog(false);
      setLocationToEdit(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update location",
        variant: "destructive",
      });
    },
  });
  
  // Delete location
  const deleteLocationMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/locations/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Location deleted",
        description: "Storage location removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete location",
        variant: "destructive",
      });
    },
  });
  
  // Reset new location form
  const resetNewLocationForm = () => {
    setNewLocation({
      name: "",
      type: "fridge",
    });
  };
  
  // Open edit dialog with location data
  const handleEditLocation = (location: Location) => {
    setLocationToEdit(location);
    setOpenEditDialog(true);
  };
  
  // Delete location with confirmation
  const handleDeleteLocation = (id: number) => {
    if (window.confirm("Are you sure you want to delete this location? All food items in this location will also be deleted.")) {
      deleteLocationMutation.mutate(id);
    }
  };
  
  // Get icon for location type
  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'fridge':
        return <Refrigerator className="h-5 w-5 text-blue-500" />;
      case 'freezer':
        return <Refrigerator className="h-5 w-5 text-cyan-500" />;
      case 'pantry':
        return <Box className="h-5 w-5 text-amber-500" />;
      case 'cupboard':
        return <Home className="h-5 w-5 text-gray-500" />;
      case 'shopping':
        return <ShoppingBag className="h-5 w-5 text-green-500" />;
      case 'warehouse':
        return <Warehouse className="h-5 w-5 text-purple-500" />;
      default:
        return <Box className="h-5 w-5 text-muted-foreground" />;
    }
  };
  
  // Get items count per location
  const getItemCount = async (locationId: number) => {
    try {
      const items = await apiRequest(`/api/food-items?locationId=${locationId}`);
      return Array.isArray(items) ? items.length : 0;
    } catch (error) {
      console.error("Error fetching items count:", error);
      return 0;
    }
  };
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Storage Locations</h1>
            <p className="text-muted-foreground">
              Manage where you store your food items
            </p>
          </div>
          <Button onClick={() => setOpenAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Location
          </Button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : locations.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Warehouse className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No storage locations</h3>
              <p className="text-muted-foreground mb-4">
                Add your first storage location to organize your food items
              </p>
              <Button 
                onClick={() => setOpenAddDialog(true)}
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" /> Add First Location
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {locations.map(location => (
              <Card key={location.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    {getLocationIcon(location.type)}
                    {location.name}
                  </CardTitle>
                  <CardDescription>
                    {location.type.charAt(0).toUpperCase() + location.type.slice(1)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Created on {new Date(location.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t p-4 bg-muted/30">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDeleteLocation(location.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => handleEditLocation(location)}
                  >
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Add Location Dialog */}
      <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Storage Location</DialogTitle>
            <DialogDescription>
              Create a new location to store your food items
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Location Name</Label>
              <Input
                id="name"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                placeholder="e.g. Kitchen Fridge, Basement Pantry"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="type">Location Type</Label>
              <Select 
                value={newLocation.type}
                onValueChange={(value) => setNewLocation({ ...newLocation, type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fridge">Fridge</SelectItem>
                  <SelectItem value="freezer">Freezer</SelectItem>
                  <SelectItem value="pantry">Pantry</SelectItem>
                  <SelectItem value="cupboard">Cupboard</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="shopping">Shopping List</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => addLocationMutation.mutate(newLocation)}
              disabled={!newLocation.name || addLocationMutation.isPending}
            >
              {addLocationMutation.isPending ? "Adding..." : "Add Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Location Dialog */}
      {locationToEdit && (
        <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Storage Location</DialogTitle>
              <DialogDescription>
                Update your storage location details
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Location Name</Label>
                <Input
                  id="edit-name"
                  value={locationToEdit.name}
                  onChange={(e) => setLocationToEdit({ ...locationToEdit, name: e.target.value })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-type">Location Type</Label>
                <Select 
                  value={locationToEdit.type}
                  onValueChange={(value) => setLocationToEdit({ ...locationToEdit, type: value })}
                >
                  <SelectTrigger id="edit-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fridge">Fridge</SelectItem>
                    <SelectItem value="freezer">Freezer</SelectItem>
                    <SelectItem value="pantry">Pantry</SelectItem>
                    <SelectItem value="cupboard">Cupboard</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="shopping">Shopping List</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenEditDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => updateLocationMutation.mutate(locationToEdit)}
                disabled={!locationToEdit.name || updateLocationMutation.isPending}
              >
                {updateLocationMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}