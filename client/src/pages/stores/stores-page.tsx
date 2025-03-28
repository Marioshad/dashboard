import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import { 
  Pencil, 
  Trash2, 
  Eye, 
  Plus, 
  Store 
} from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Define Store type locally until we fix the import
type StoreType = {
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

export function StoresPage() {
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [newStore, setNewStore] = useState({
    name: '',
    location: '',
    phone: '',
    fax: '',
    vatNumber: '',
    taxId: '',
  });
  const [storeToDelete, setStoreToDelete] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: stores, isLoading } = useQuery<StoreType[]>({
    queryKey: ['/api/stores'],
  });

  const createStoreMutation = useMutation({
    mutationFn: async (newStore: Omit<StoreType, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newStore),
      });
      if (!response.ok) {
        throw new Error('Failed to create store');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
      setStoreDialogOpen(false);
      setNewStore({
        name: '',
        location: '',
        phone: '',
        fax: '',
        vatNumber: '',
        taxId: '',
      });
      toast({
        title: 'Store created',
        description: 'The store has been created successfully',
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
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/stores/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete store');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
      setDeleteDialogOpen(false);
      setStoreToDelete(null);
      toast({
        title: 'Store deleted',
        description: 'The store has been deleted successfully',
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

  const handleCreateStore = (e: React.FormEvent) => {
    e.preventDefault();
    createStoreMutation.mutate(newStore);
  };

  const handleDeleteStore = () => {
    if (storeToDelete !== null) {
      deleteStoreMutation.mutate(storeToDelete);
    }
  };

  const viewStoreDetails = (storeId: number) => {
    navigate(`/stores/${storeId}`);
  };

  const confirmDelete = (storeId: number) => {
    setStoreToDelete(storeId);
    setDeleteDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Stores Management</h1>
          <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Store
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Store</DialogTitle>
                <DialogDescription>
                  Enter the details of the store you want to add.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateStore}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={newStore.name}
                      onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="location" className="text-right">
                      Location <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="location"
                      value={newStore.location}
                      onChange={(e) => setNewStore({ ...newStore, location: e.target.value })}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone" className="text-right">
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      value={newStore.phone}
                      onChange={(e) => setNewStore({ ...newStore, phone: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="fax" className="text-right">
                      Fax
                    </Label>
                    <Input
                      id="fax"
                      value={newStore.fax}
                      onChange={(e) => setNewStore({ ...newStore, fax: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="vatNumber" className="text-right">
                      VAT Number
                    </Label>
                    <Input
                      id="vatNumber"
                      value={newStore.vatNumber}
                      onChange={(e) => setNewStore({ ...newStore, vatNumber: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="taxId" className="text-right">
                      Tax ID
                    </Label>
                    <Input
                      id="taxId"
                      value={newStore.taxId}
                      onChange={(e) => setNewStore({ ...newStore, taxId: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={createStoreMutation.isPending}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                  >
                    {createStoreMutation.isPending ? 'Creating...' : 'Create Store'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Stores</CardTitle>
            <CardDescription>
              Manage places where you purchase your groceries and food items.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center p-4">Loading stores...</div>
            ) : stores && stores.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>VAT Number</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell className="font-medium">{store.name}</TableCell>
                      <TableCell>{store.location}</TableCell>
                      <TableCell>{store.phone}</TableCell>
                      <TableCell>{store.vatNumber}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewStoreDetails(store.id)}
                            className="h-8 w-8 p-0"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/stores/${store.id}`)}
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => confirmDelete(store.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center p-8">
                <Store className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">No stores</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating a new store.
                </p>
                <div className="mt-6">
                  <Button
                    onClick={() => setStoreDialogOpen(true)}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Store
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this store and all of its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStore}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}