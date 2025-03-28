import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Building, Package2, Plus, RefreshCw, PenSquare, Trash2, Eye, EyeIcon, Info } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Store type definition
interface Store {
  id: number;
  name: string;
  location: string;
  phone?: string;
  fax?: string;
  vatNumber?: string;
  taxId?: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

// Form schema for creating/editing a store
const storeFormSchema = z.object({
  name: z.string()
    .min(1, "Store name is required")
    .min(2, "Store name must be at least 2 characters")
    .max(100, "Store name cannot exceed 100 characters"),
  location: z.string()
    .min(1, "Store location is required")
    .min(2, "Store location must be at least 2 characters")
    .max(200, "Location cannot exceed 200 characters"),
  phone: z.string()
    .max(30, "Phone number cannot exceed 30 characters")
    .regex(/^[0-9+\-\s()]*$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
  fax: z.string()
    .max(30, "Fax number cannot exceed 30 characters")
    .regex(/^[0-9+\-\s()]*$/, "Invalid fax number format")
    .optional()
    .or(z.literal("")),
  vatNumber: z.string()
    .max(50, "VAT number cannot exceed 50 characters")
    .optional()
    .or(z.literal("")),
  taxId: z.string()
    .max(50, "Tax ID cannot exceed 50 characters")
    .optional()
    .or(z.literal("")),
});

type StoreFormValues = z.infer<typeof storeFormSchema>;

export function StoresPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useParams();
  const storeIdFromUrl = params.storeId ? parseInt(params.storeId) : null;
  const [, navigate] = useLocation();

  // Fetch all stores
  const storesQuery = useQuery({
    queryKey: ["/api/stores"],
    meta: {
      errorMessage: "Failed to load stores",
    },
  });

  // Create a new store
  const createStoreMutation = useMutation({
    mutationFn: (data: StoreFormValues) => {
      return apiRequest("/api/stores", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Store created",
        description: "The store has been created successfully.",
      });
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create store.",
        variant: "destructive",
      });
    },
  });

  // Update an existing store
  const updateStoreMutation = useMutation({
    mutationFn: (data: StoreFormValues & { id: number }) => {
      return apiRequest(`/api/stores/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: data.name,
          location: data.location,
          phone: data.phone,
          fax: data.fax,
          vatNumber: data.vatNumber,
          taxId: data.taxId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Store updated",
        description: "The store has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update store.",
        variant: "destructive",
      });
    },
  });

  // Delete a store
  const deleteStoreMutation = useMutation({
    mutationFn: async (storeId: number) => {
      const response = await apiRequest(`/api/stores/${storeId}`, {
        method: "DELETE",
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Store deleted",
        description: data.message || "The store has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete store.",
        variant: "destructive",
      });
    },
  });

  // Add store form
  const addStoreForm = useForm<StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      name: "",
      location: "",
      phone: "",
      fax: "",
      vatNumber: "",
      taxId: "",
    },
  });

  // Edit store form
  const editStoreForm = useForm<StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      name: "",
      location: "",
      phone: "",
      fax: "",
      vatNumber: "",
      taxId: "",
    },
  });

  function handleAddSubmit(data: StoreFormValues) {
    createStoreMutation.mutate(data);
  }

  function handleEditSubmit(data: StoreFormValues) {
    if (currentStore) {
      updateStoreMutation.mutate({ ...data, id: currentStore.id });
    }
  }

  function openEditDialog(store: Store) {
    setCurrentStore(store);
    editStoreForm.reset({
      name: store.name,
      location: store.location,
      phone: store.phone || "",
      fax: store.fax || "",
      vatNumber: store.vatNumber || "",
      taxId: store.taxId || "",
    });
    setIsEditDialogOpen(true);
  }

  function handleAddDialogClose() {
    addStoreForm.reset();
    setIsAddDialogOpen(false);
  }

  function handleEditDialogClose() {
    editStoreForm.reset();
    setIsEditDialogOpen(false);
    setCurrentStore(null);
  }

  function handleDelete(storeId: number) {
    deleteStoreMutation.mutate(storeId);
  }
  
  function openViewDialog(store: Store) {
    setCurrentStore(store);
    setIsViewDialogOpen(true);
  }
  
  function handleViewDialogClose() {
    setIsViewDialogOpen(false);
    setCurrentStore(null);
  }

  // Effect to handle opening the edit dialog when a store ID is provided in the URL
  useEffect(() => {
    if (storeIdFromUrl && storesQuery.data) {
      const stores = storesQuery.data as Store[];
      const storeToEdit = stores.find(store => store.id === storeIdFromUrl);
      
      if (storeToEdit) {
        openEditDialog(storeToEdit);
      } else {
        // If store ID is invalid, show a toast message
        toast({
          title: "Store not found",
          description: `Could not find a store with ID ${storeIdFromUrl}`,
          variant: "destructive",
        });
      }
    }
  }, [storeIdFromUrl, storesQuery.data]);

  const stores = storesQuery.data as Store[] || [];

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stores</h1>
            <p className="text-muted-foreground">
              Manage your stores where you purchase food items
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/stores"] })}
              disabled={storesQuery.isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${storesQuery.isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Store
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add new store</DialogTitle>
                  <DialogDescription>
                    Create a new store where you purchase food items. Fields marked with <span className="text-destructive">*</span> are required.
                  </DialogDescription>
                </DialogHeader>
                <Form {...addStoreForm}>
                  <form onSubmit={addStoreForm.handleSubmit(handleAddSubmit)} className="space-y-4">
                    <FormField
                      control={addStoreForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Store Name <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Supermarket name" required />
                          </FormControl>
                          <FormDescription>
                            Store name is required
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addStoreForm.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Location <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Address or location of the store" required />
                          </FormControl>
                          <FormDescription>
                            Store location is required
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addStoreForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Store phone number (optional)" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addStoreForm.control}
                      name="fax"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fax</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Store fax number (optional)" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addStoreForm.control}
                      name="vatNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>VAT Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="VAT registration (optional)" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addStoreForm.control}
                      name="taxId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax ID</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Tax identifier (optional)" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2 mt-6">
                      <Button variant="outline" type="button" onClick={handleAddDialogClose}>
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createStoreMutation.isPending}
                      >
                        {createStoreMutation.isPending ? "Adding..." : "Add Store"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Building className="h-5 w-5 mr-2" />
              Your Stores
            </CardTitle>
            <CardDescription>
              All the stores where you have purchased food items
            </CardDescription>
          </CardHeader>
          <CardContent>
            {storesQuery.isLoading ? (
              <div className="py-10 text-center">
                <RefreshCw className="h-8 w-8 mx-auto animate-spin text-primary/60" />
                <p className="mt-2 text-muted-foreground">Loading stores...</p>
              </div>
            ) : stores.length === 0 ? (
              <div className="py-10 text-center border rounded-lg">
                <Building className="h-12 w-12 mx-auto text-muted-foreground/60" />
                <h3 className="mt-4 text-lg font-medium">No stores yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Get started by adding your first store or upload a receipt to auto-detect stores.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Store
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Added On</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stores.map((store) => (
                      <TableRow key={store.id}>
                        <TableCell className="font-medium">{store.name}</TableCell>
                        <TableCell>{store.location}</TableCell>
                        <TableCell>
                          {store.phone ? (
                            <div>Phone: {store.phone}</div>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">No contact info</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(store.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/stores/${store.id}`)}
                              className="text-blue-500"
                            >
                              <EyeIcon className="h-4 w-4" />
                              <span className="sr-only">View</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/stores/${store.id}`)}
                            >
                              <PenSquare className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Store</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{store.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(store.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Store Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit store</DialogTitle>
            <DialogDescription>
              Update the store information. Fields marked with <span className="text-destructive">*</span> are required.
            </DialogDescription>
          </DialogHeader>
          <Form {...editStoreForm}>
            <form onSubmit={editStoreForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editStoreForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Store Name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Supermarket name" required />
                    </FormControl>
                    <FormDescription>
                      Store name is required
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editStoreForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Location <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Address or location of the store" required />
                    </FormControl>
                    <FormDescription>
                      Store location is required
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editStoreForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Store phone number (optional)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editStoreForm.control}
                name="fax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fax</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Store fax number (optional)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editStoreForm.control}
                name="vatNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VAT Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="VAT registration (optional)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editStoreForm.control}
                name="taxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Tax identifier (optional)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" type="button" onClick={handleEditDialogClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateStoreMutation.isPending}
                >
                  {updateStoreMutation.isPending ? "Updating..." : "Update Store"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Store Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Building className="h-5 w-5" />
              <span>{currentStore?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Store details and information
            </DialogDescription>
          </DialogHeader>
          
          {currentStore && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Store Name</h3>
                  <p className="font-medium">{currentStore.name}</p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Location</h3>
                  <p>{currentStore.location}</p>
                </div>
              </div>

              <Separator />
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Contact Information</h3>
                  {currentStore.phone ? (
                    <p>Phone: {currentStore.phone}</p>
                  ) : (
                    <p className="text-muted-foreground italic text-sm">No phone number</p>
                  )}
                  
                  {currentStore.fax ? (
                    <p>Fax: {currentStore.fax}</p>
                  ) : (
                    <p className="text-muted-foreground italic text-sm">No fax number</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Tax Information</h3>
                  {currentStore.vatNumber ? (
                    <p>VAT Number: {currentStore.vatNumber}</p>
                  ) : (
                    <p className="text-muted-foreground italic text-sm">No VAT number</p>
                  )}
                  
                  {currentStore.taxId ? (
                    <p>Tax ID: {currentStore.taxId}</p>
                  ) : (
                    <p className="text-muted-foreground italic text-sm">No tax ID</p>
                  )}
                </div>
              </div>

              <Separator />
              
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Store History</h3>
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Added on</p>
                    <p>{format(new Date(currentStore.createdAt), "MMMM d, yyyy 'at' h:mm a")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last updated</p>
                    <p>{format(new Date(currentStore.updatedAt), "MMMM d, yyyy 'at' h:mm a")}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button 
                  variant="outline" 
                  onClick={handleViewDialogClose}
                >
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    handleViewDialogClose();
                    openEditDialog(currentStore);
                  }}
                >
                  <PenSquare className="h-4 w-4 mr-2" />
                  Edit Store
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}