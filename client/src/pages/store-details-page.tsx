import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Building, ArrowLeft, Save, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
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
import { Skeleton } from "@/components/ui/skeleton";

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

// Form schema for editing a store
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

export default function StoreDetailsPage() {
  const params = useParams();
  const storeId = params.storeId ? parseInt(params.storeId) : null;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Fetch store details
  const storeQuery = useQuery({
    queryKey: ["/api/stores", storeId],
    queryFn: async () => {
      if (!storeId) throw new Error("Store ID is required");
      const store = await apiRequest(`/api/stores/${storeId}`);
      return store as Store;
    },
    enabled: !!storeId,
    meta: {
      errorMessage: "Failed to load store details",
    },
  });

  // Update store
  const updateStoreMutation = useMutation({
    mutationFn: (data: StoreFormValues) => {
      if (!storeId) throw new Error("Store ID is required");
      return apiRequest(`/api/stores/${storeId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
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
      queryClient.invalidateQueries({ queryKey: ["/api/stores", storeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update store.",
        variant: "destructive",
      });
    },
  });

  // Delete store
  const deleteStoreMutation = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Store ID is required");
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
      navigate('/stores');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete store.",
        variant: "destructive",
      });
    },
  });

  // Edit store form
  const storeForm = useForm<StoreFormValues>({
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

  // Update form values when store data is loaded
  useEffect(() => {
    if (storeQuery.data) {
      storeForm.reset({
        name: storeQuery.data.name,
        location: storeQuery.data.location,
        phone: storeQuery.data.phone || "",
        fax: storeQuery.data.fax || "",
        vatNumber: storeQuery.data.vatNumber || "",
        taxId: storeQuery.data.taxId || "",
      });
    }
  }, [storeQuery.data, storeForm]);

  function handleSubmit(data: StoreFormValues) {
    updateStoreMutation.mutate(data);
  }

  function handleDelete() {
    deleteStoreMutation.mutate();
  }

  // Toggle between view and edit modes
  function toggleEditMode() {
    setIsEditing(!isEditing);
    
    // If canceling edit, reset form to original values
    if (isEditing && storeQuery.data) {
      storeForm.reset({
        name: storeQuery.data.name,
        location: storeQuery.data.location,
        phone: storeQuery.data.phone || "",
        fax: storeQuery.data.fax || "",
        vatNumber: storeQuery.data.vatNumber || "",
        taxId: storeQuery.data.taxId || "",
      });
    }
  }

  const store = storeQuery.data;
  const isLoading = storeQuery.isLoading;

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Button 
              variant="outline" 
              onClick={() => navigate('/stores')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Stores
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">
              {isLoading ? (
                <Skeleton className="h-9 w-48" />
              ) : (
                <>
                  {isEditing ? "Edit Store" : "Store Details"}
                </>
              )}
            </h1>
            {!isLoading && store && (
              <p className="text-muted-foreground">
                {isEditing ? `Editing "${store.name}"` : store.name}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Button onClick={toggleEditMode}>
                  Edit Store
                </Button>
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Store</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this store? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <Button variant="outline" onClick={toggleEditMode}>
                Cancel
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : store ? (
          isEditing ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Building className="h-5 w-5 mr-2" />
                  Edit Store Information
                </CardTitle>
                <CardDescription>
                  Update the details for this store. Fields marked with <span className="text-destructive">*</span> are required.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...storeForm}>
                  <form onSubmit={storeForm.handleSubmit(handleSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                      <FormField
                        control={storeForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Store Name <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Supermarket name" required />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={storeForm.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Location <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Address or location of the store" required />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={storeForm.control}
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
                        control={storeForm.control}
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
                        control={storeForm.control}
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
                        control={storeForm.control}
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
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                      <Button 
                        type="submit" 
                        disabled={updateStoreMutation.isPending}
                        className="bg-gradient-to-r from-primary/90 to-primary"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateStoreMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Building className="h-5 w-5 mr-2" />
                  {store.name}
                </CardTitle>
                <CardDescription>
                  Store details and information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Store Name</h3>
                    <p className="font-medium text-lg">{store.name}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Location</h3>
                    <p className="text-lg">{store.location}</p>
                  </div>
                
                  {store.phone && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Phone Number</h3>
                      <p>{store.phone}</p>
                    </div>
                  )}
                  
                  {store.fax && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Fax</h3>
                      <p>{store.fax}</p>
                    </div>
                  )}
                  
                  {store.vatNumber && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">VAT Number</h3>
                      <p>{store.vatNumber}</p>
                    </div>
                  )}
                  
                  {store.taxId && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Tax ID</h3>
                      <p>{store.taxId}</p>
                    </div>
                  )}
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Store History</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                    <div className="mb-2 sm:mb-0">
                      <p className="text-sm text-muted-foreground">Added on</p>
                      <p>{format(new Date(store.createdAt), "MMMM d, yyyy 'at' h:mm a")}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last updated</p>
                      <p>{format(new Date(store.updatedAt), "MMMM d, yyyy 'at' h:mm a")}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t bg-gray-50 px-6 py-3">
                <div className="flex justify-end w-full gap-2">
                  <Button 
                    variant="outline" 
                    onClick={toggleEditMode}
                    className="bg-white"
                  >
                    Edit Store Details
                  </Button>
                </div>
              </CardFooter>
            </Card>
          )
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Store Not Found</CardTitle>
              <CardDescription>
                The store you're looking for could not be found.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Please check the store ID and try again, or go back to the stores list.</p>
              <Button 
                onClick={() => navigate('/stores')}
                className="mt-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Stores
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}