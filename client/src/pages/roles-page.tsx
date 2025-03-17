import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { insertRoleSchema, type Role, type Permission } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";

interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export default function RolesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null);

  const isAdmin = user?.roleId === 1 || user?.roleId === 2; // Superadmin or Admin

  const { data: roles, isLoading: rolesLoading } = useQuery<RoleWithPermissions[]>({
    queryKey: ["/api/roles"],
    enabled: isAdmin,
  });

  const { data: permissions, isLoading: permissionsLoading } = useQuery<Permission[]>({
    queryKey: ["/api/permissions"],
    enabled: isAdmin,
  });

  const form = useForm<z.infer<typeof insertRoleSchema>>({
    resolver: zodResolver(insertRoleSchema),
    defaultValues: {
      name: "",
      description: "",
      permissions: [],
    },
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!selectedRole) {
      form.reset({
        name: "",
        description: "",
        permissions: [],
      });
    } else {
      form.reset({
        name: selectedRole.name,
        description: selectedRole.description || "",
        permissions: selectedRole.permissions.map((p) => p.id),
      });
    }
  }, [selectedRole, form]);

  const createRoleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertRoleSchema>) => {
      const res = await apiRequest("POST", "/api/roles", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({
        title: "Role Created",
        description: "The role has been created successfully",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertRoleSchema> & { id: number }) => {
      const { id, ...updateData } = data;
      const res = await apiRequest("PATCH", `/api/roles/${id}`, updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({
        title: "Role Updated",
        description: "The role has been updated successfully",
      });
      setSelectedRole(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({
        title: "Role Deleted",
        description: "The role has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">
            You don't have permission to view this page.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (rolesLoading || permissionsLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles Management</h1>
          <p className="text-muted-foreground">
            Create and manage roles and their permissions
          </p>
        </div>

        <div className="grid gap-6">
          {/* Create Role */}
          <Card>
            <CardHeader>
              <CardTitle>Create Role</CardTitle>
              <CardDescription>
                Add a new role with assigned permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) =>
                    createRoleMutation.mutate(data)
                  )}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="admin" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Administrative access with full permissions"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="permissions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Permissions</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => {
                              const currentValue = Array.isArray(field.value)
                                ? field.value
                                : [];
                              const numValue = Number(value);
                              const newValue = currentValue.includes(numValue)
                                ? currentValue.filter((v) => v !== numValue)
                                : [...currentValue, numValue];
                              field.onChange(newValue);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select permissions" />
                            </SelectTrigger>
                            <SelectContent>
                              {permissions?.map((permission) => (
                                <SelectItem
                                  key={permission.id}
                                  value={permission.id.toString()}
                                >
                                  {permission.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {field.value?.map((permissionId) => {
                            const permission = permissions?.find(
                              (p) => p.id === permissionId
                            );
                            return (
                              permission && (
                                <Badge
                                  key={permission.id}
                                  variant="secondary"
                                  className="text-xs cursor-pointer"
                                  onClick={() => {
                                    const newValue = field.value.filter(
                                      (id) => id !== permission.id
                                    );
                                    field.onChange(newValue);
                                  }}
                                >
                                  {permission.name} ×
                                </Badge>
                              )
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={createRoleMutation.isPending}
                  >
                    {createRoleMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <Plus className="mr-2 h-4 w-4" />
                    Create Role
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Roles Table */}
          <Card>
            <CardHeader>
              <CardTitle>Roles and Permissions Overview</CardTitle>
              <CardDescription>
                Detailed view of all roles and their assigned permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Permissions Count</TableHead>
                    <TableHead>Assigned Permissions</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles?.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>{role.description}</TableCell>
                      <TableCell className="text-center">
                        {role.permissions.length}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions.map((permission) => (
                            <Badge
                              key={permission.id}
                              variant="outline"
                              className="text-xs"
                            >
                              {permission.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(
                          role.updatedAt || role.createdAt
                        ).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Roles List */}
          <Card>
            <CardHeader>
              <CardTitle>All Roles</CardTitle>
              <CardDescription>
                View and manage existing roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {roles?.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <h3 className="font-medium">{role.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {role.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {role.permissions?.map((permission) => (
                          <Badge
                            key={permission.id}
                            variant="outline"
                            className="text-xs"
                          >
                            {permission.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Dialog
                        open={selectedRole?.id === role.id}
                        onOpenChange={(open) => {
                          if (!open) setSelectedRole(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setSelectedRole(role)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Role</DialogTitle>
                          </DialogHeader>
                          <Form {...form}>
                            <form
                              onSubmit={form.handleSubmit((data) =>
                                updateRoleMutation.mutate({
                                  ...data,
                                  id: role.id,
                                })
                              )}
                              className="space-y-4"
                            >
                              <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                      <Textarea {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="permissions"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Permissions</FormLabel>
                                    <FormControl>
                                      <Select
                                        onValueChange={(value) => {
                                          const currentValue = Array.isArray(
                                            field.value
                                          )
                                            ? field.value
                                            : [];
                                          const numValue = Number(value);
                                          const newValue = currentValue.includes(
                                            numValue
                                          )
                                            ? currentValue.filter(
                                                (v) => v !== numValue
                                              )
                                            : [...currentValue, numValue];
                                          field.onChange(newValue);
                                        }}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select permissions" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {permissions?.map((permission) => (
                                            <SelectItem
                                              key={permission.id}
                                              value={permission.id.toString()}
                                            >
                                              {permission.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </FormControl>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {field.value?.map((permissionId) => {
                                        const permission = permissions?.find(
                                          (p) => p.id === permissionId
                                        );
                                        return (
                                          permission && (
                                            <Badge
                                              key={permission.id}
                                              variant="secondary"
                                              className="text-xs cursor-pointer"
                                              onClick={() => {
                                                const newValue = field.value.filter(
                                                  (id) =>
                                                    id !== permission.id
                                                );
                                                field.onChange(newValue);
                                              }}
                                            >
                                              {permission.name} ×
                                            </Badge>
                                          )
                                        );
                                      })}
                                    </div>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <Button
                                type="submit"
                                disabled={updateRoleMutation.isPending}
                              >
                                {updateRoleMutation.isPending && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Update Role
                              </Button>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteRoleMutation.mutate(role.id)}
                        disabled={deleteRoleMutation.isPending}
                      >
                        {deleteRoleMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}