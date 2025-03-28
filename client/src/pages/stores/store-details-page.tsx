import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  ArrowLeft, 
  Save, 
  Trash2,
  Store as StoreIcon,
  MapPin,
  Phone,
  Printer,
  FileText,
  Building
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// Define Store type locally until we fix the import
type Store = {
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
};

const storeFormSchema = z.object({
  name: z.string().min(1, 'Store name is required'),
  location: z.string().min(1, 'Location is required'),
  phone: z.string().optional(),
  fax: z.string().optional(),
  vatNumber: z.string().optional(),
  taxId: z.string().optional(),
});

type StoreFormValues = z.infer<typeof storeFormSchema>;

export function StoreDetailsPage() {
  const [, params] = useRoute<{ storeId: string }>('/stores/:storeId');
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const storeId = params?.storeId ? parseInt(params.storeId) : null;
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);

  const { data: store, isLoading } = useQuery<Store>({ 
    queryKey: [`/api/stores/${storeId}`],
    enabled: !!storeId,
  });

  const form = useForm<StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      name: '',
      location: '',
      phone: '',
      fax: '',
      vatNumber: '',
      taxId: '',
    },
  });

  // Update form values when store data is loaded
  useEffect(() => {
    if (store) {
      form.reset({
        name: store.name,
        location: store.location,
        phone: store.phone || '',
        fax: store.fax || '',
        vatNumber: store.vatNumber || '',
        taxId: store.taxId || '',
      });
    }
  }, [store, form]);

  const updateStoreMutation = useMutation({
    mutationFn: async (values: StoreFormValues) => {
      if (!storeId) throw new Error('Store ID is required');
      
      const response = await fetch(`/api/stores/${storeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update store');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
      toast({
        title: 'Store updated',
        description: 'The store has been updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteStoreMutation = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error('Store ID is required');
      
      const response = await fetch(`/api/stores/${storeId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete store');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
      toast({
        title: 'Store deleted',
        description: 'The store has been deleted successfully',
      });
      navigate('/stores');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (values: StoreFormValues) => {
    updateStoreMutation.mutate(values);
  };

  const handleDelete = () => {
    if (deleteConfirmation) {
      deleteStoreMutation.mutate();
    } else {
      setDeleteConfirmation(true);
      setTimeout(() => setDeleteConfirmation(false), 3000);
    }
  };

  if (isLoading || !store) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-4">
          <div className="flex items-center mb-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/stores')}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Loading Store Details...</h1>
          </div>
          <div className="p-12 text-center">Loading store details...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/stores')}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">{store.name}</h1>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteStoreMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteConfirmation 
                ? 'Confirm Delete' 
                : deleteStoreMutation.isPending 
                  ? 'Deleting...' 
                  : 'Delete Store'
              }
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Store Details</CardTitle>
                <CardDescription>
                  Update information about this store
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form 
                    onSubmit={form.handleSubmit(onSubmit)} 
                    className="space-y-6"
                  >
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Store Name <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <div className="flex items-center space-x-2">
                                <StoreIcon className="h-4 w-4 text-gray-400" />
                                <Input {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Location <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <div className="flex items-center space-x-2">
                                <MapPin className="h-4 w-4 text-gray-400" />
                                <Input {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <div className="flex items-center space-x-2">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <Input {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="fax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fax Number</FormLabel>
                            <FormControl>
                              <div className="flex items-center space-x-2">
                                <Printer className="h-4 w-4 text-gray-400" />
                                <Input {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="vatNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VAT Number</FormLabel>
                            <FormControl>
                              <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4 text-gray-400" />
                                <Input {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="taxId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax ID</FormLabel>
                            <FormControl>
                              <div className="flex items-center space-x-2">
                                <Building className="h-4 w-4 text-gray-400" />
                                <Input {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      disabled={updateStoreMutation.isPending}
                      className="w-full md:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updateStoreMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Store Information</CardTitle>
                <CardDescription>
                  Additional details about this store
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-gray-200">
                  <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm font-medium text-gray-500">Created</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                      {new Date(store.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                  <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                      {new Date(store.updatedAt).toLocaleDateString()}
                    </dd>
                  </div>
                  <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm font-medium text-gray-500">Store ID</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                      {store.id}
                    </dd>
                  </div>
                </dl>
              </CardContent>
              <CardFooter className="bg-gray-50 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Store information is used to categorize and organize your food items.
                </p>
              </CardFooter>
            </Card>
            
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Related Items</CardTitle>
                <CardDescription>
                  Items purchased from this store
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center p-4 text-gray-500">
                  Related items feature coming soon.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}