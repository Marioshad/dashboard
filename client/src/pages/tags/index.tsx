import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tag, Plus, Edit, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Define tag schema
const tagSchema = z.object({
  name: z.string().min(1, "Tag name is required"),
  color: z.string().min(1, "Color is required"),
});

type TagFormData = z.infer<typeof tagSchema>;

interface Tag {
  id: number;
  name: string;
  color: string;
  is_system: boolean;
  user_id: number | null;
}

export default function TagsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editTag, setEditTag] = useState<Tag | null>(null);

  // Form setup
  const addTagForm = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: "",
      color: "#6B7280", // Default gray color
    },
  });

  const editTagForm = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: "",
      color: "#6B7280",
    },
  });

  // Setup edit mode when a tag is selected for editing
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Query to fetch tags
  const tagsQuery = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (data: TagFormData) => {
      return await apiRequest("/api/tags", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tag created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setIsAddDialogOpen(false);
      addTagForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create tag: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TagFormData }) => {
      return await apiRequest(`/api/tags/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tag updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setIsEditDialogOpen(false);
      setEditTag(null);
      editTagForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update tag: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/tags/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tag deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete tag: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Form submission handlers
  const onAddSubmit = (data: TagFormData) => {
    createTagMutation.mutate(data);
  };

  const onEditSubmit = (data: TagFormData) => {
    if (editTag) {
      updateTagMutation.mutate({ id: editTag.id, data });
    }
  };

  const handleEditClick = (tag: Tag) => {
    setEditTag(tag);
    editTagForm.reset({
      name: tag.name,
      color: tag.color,
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (tag: Tag) => {
    if (window.confirm(`Are you sure you want to delete the tag "${tag.name}"?`)) {
      deleteTagMutation.mutate(tag.id);
    }
  };

  // Group tags: System tags and user tags
  const systemTags = tagsQuery.data?.filter(tag => tag.is_system) || [];
  const userTags = tagsQuery.data?.filter(tag => !tag.is_system) || [];

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tags</h1>
            <p className="text-muted-foreground">
              Manage tags for categorizing your food items
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/tags"] })}
              disabled={tagsQuery.isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${tagsQuery.isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tag
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add new tag</DialogTitle>
                  <DialogDescription>
                    Create a new tag for categorizing food items.
                  </DialogDescription>
                </DialogHeader>
                <Form {...addTagForm}>
                  <form onSubmit={addTagForm.handleSubmit(onAddSubmit)} className="space-y-4">
                    <FormField
                      control={addTagForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Organic" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addTagForm.control}
                      name="color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color</FormLabel>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="color"
                              className="w-12 h-8 p-1"
                              {...field}
                            />
                            <Input
                              type="text"
                              className="flex-1"
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="#HEX"
                            />
                          </div>
                          <FormDescription>
                            Select a color for the tag.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createTagMutation.isPending}>
                        {createTagMutation.isPending ? "Creating..." : "Create Tag"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Tag className="h-5 w-5 mr-2 text-primary" />
                System Tags
              </CardTitle>
              <CardDescription>
                Pre-defined tags used for automatic categorization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tagsQuery.isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : systemTags.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground">
                  No system tags found
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {systemTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      className="py-1 px-3"
                      style={{ backgroundColor: tag.color, color: isLightColor(tag.color) ? 'black' : 'white' }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                System tags are used for automatic categorization of food items during receipt scanning.
              </p>
            </CardFooter>
          </Card>

          {/* User Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Tag className="h-5 w-5 mr-2 text-primary" />
                Custom Tags
              </CardTitle>
              <CardDescription>
                Your custom tags for organizing food items
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tagsQuery.isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : userTags.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground">
                  No custom tags found. Create a new tag to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {userTags.map((tag) => (
                    <div key={tag.id} className="flex items-center justify-between p-2 border rounded-md">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span>{tag.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(tag)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(tag)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                Custom tags can be assigned to food items to create your own organization system.
              </p>
            </CardFooter>
          </Card>
        </div>

        {/* Edit Tag Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit tag</DialogTitle>
              <DialogDescription>
                Update the tag's name and color.
              </DialogDescription>
            </DialogHeader>
            <Form {...editTagForm}>
              <form onSubmit={editTagForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editTagForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Organic" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editTagForm.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="color"
                          className="w-12 h-8 p-1"
                          {...field}
                        />
                        <Input
                          type="text"
                          className="flex-1"
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="#HEX"
                        />
                      </div>
                      <FormDescription>
                        Select a color for the tag.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={updateTagMutation.isPending}>
                    {updateTagMutation.isPending ? "Updating..." : "Update Tag"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// Utility function to determine if a color is light
function isLightColor(color: string): boolean {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5;
}