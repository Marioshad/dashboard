import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tag } from "@shared/schema";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Tag as TagIcon,
  Trash2,
  Edit,
  Hash,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function TagsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [tagToEdit, setTagToEdit] = useState<Tag | null>(null);
  
  // State for new/edit tag
  const [tagData, setTagData] = useState<{
    name: string;
    color: string;
  }>({
    name: "",
    color: "#3B82F6", // Default blue color
  });
  
  // Fetch tags
  const {
    data: tags = [],
    isLoading,
    refetch,
  } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
    queryFn: async () => {
      return await apiRequest("/api/tags") as Tag[];
    },
  });
  
  // Add new tag
  const addTagMutation = useMutation({
    mutationFn: async (tag: typeof tagData) => {
      return await apiRequest("/api/tags", {
        method: "POST",
        body: JSON.stringify(tag),
        headers: {
          "Content-Type": "application/json",
        },
      }) as Tag;
    },
    onSuccess: () => {
      toast({
        title: "Tag added",
        description: "Tag was added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setOpenAddDialog(false);
      resetTagForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add tag",
        variant: "destructive",
      });
    },
  });
  
  // Update tag
  const updateTagMutation = useMutation({
    mutationFn: async ({ id, tag }: { id: number; tag: typeof tagData }) => {
      return await apiRequest(`/api/tags/${id}`, {
        method: "PATCH",
        body: JSON.stringify(tag),
        headers: {
          "Content-Type": "application/json",
        },
      }) as Tag;
    },
    onSuccess: () => {
      toast({
        title: "Tag updated",
        description: "Tag was updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setOpenEditDialog(false);
      setTagToEdit(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tag",
        variant: "destructive",
      });
    },
  });
  
  // Delete tag
  const deleteTagMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/tags/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Tag deleted",
        description: "Tag was removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tag",
        variant: "destructive",
      });
    },
  });
  
  // Filter tags by search query
  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Reset tag form
  const resetTagForm = () => {
    setTagData({
      name: "",
      color: "#3B82F6",
    });
  };
  
  // Open edit dialog with tag data
  const handleEditTag = (tag: Tag) => {
    setTagToEdit(tag);
    setTagData({
      name: tag.name,
      color: tag.color || "#3B82F6",
    });
    setOpenEditDialog(true);
  };
  
  // Delete tag with confirmation
  const handleDeleteTag = (id: number) => {
    if (window.confirm("Are you sure you want to delete this tag?")) {
      deleteTagMutation.mutate(id);
    }
  };
  
  // Handle tag form submission
  const handleTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tagToEdit) {
      updateTagMutation.mutate({ id: tagToEdit.id, tag: tagData });
    } else {
      addTagMutation.mutate(tagData);
    }
  };
  
  // Handle input change for tag form
  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTagData(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tags</h1>
            <p className="text-muted-foreground">
              Manage tags for categorizing and organizing food items
            </p>
          </div>
          <Button onClick={() => setOpenAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Tag
          </Button>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="w-full sm:w-auto">
            <div className="relative">
              <Hash className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tags..."
                className="pl-8 w-full sm:w-[250px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TagIcon className="h-5 w-5 text-primary" />
              Tags
            </CardTitle>
            <CardDescription>
              {filteredTags.length} tags in your collection
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="text-center py-8">
                <TagIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No tags found</h3>
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? "Try a different search term or clear the filter" 
                    : "Add your first tag to get started"}
                </p>
                {!searchQuery && (
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={() => setOpenAddDialog(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add First Tag
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Color</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTags.map(tag => (
                      <TableRow key={tag.id}>
                        <TableCell>
                          <div 
                            className="w-6 h-6 rounded-full" 
                            style={{ backgroundColor: tag.color || "#3B82F6" }}
                          ></div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {tag.name}
                            {tag.isSystem === true && (
                              <Badge variant="secondary" className="ml-2">
                                <Star className="h-3 w-3 mr-1" />
                                System
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {tag.isSystem ? 'System' : 'User'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handleEditTag(tag)}
                                    disabled={tag.isSystem === true} // Can't edit system tags
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {tag.isSystem === true 
                                    ? "System tags cannot be edited" 
                                    : "Edit tag"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handleDeleteTag(tag.id)}
                                    disabled={tag.isSystem === true} // Can't delete system tags
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {tag.isSystem === true 
                                    ? "System tags cannot be deleted" 
                                    : "Delete tag"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
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
      
      {/* Add Tag Dialog */}
      <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Tag</DialogTitle>
            <DialogDescription>
              Create a new tag to categorize your food items.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTagSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Tag Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Enter tag name"
                  value={tagData.name}
                  onChange={handleTagInputChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="color">Tag Color</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="color"
                    name="color"
                    type="color"
                    value={tagData.color}
                    onChange={handleTagInputChange}
                    className="w-16 h-10 p-1"
                  />
                  <div className="flex-1">
                    <Input
                      name="color"
                      value={tagData.color}
                      onChange={handleTagInputChange}
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={addTagMutation.isPending}>
                {addTagMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></div>
                    Adding...
                  </div>
                ) : (
                  <>Add Tag</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Tag Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update the tag details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTagSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Tag Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  placeholder="Enter tag name"
                  value={tagData.name}
                  onChange={handleTagInputChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-color">Tag Color</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="edit-color"
                    name="color"
                    type="color"
                    value={tagData.color}
                    onChange={handleTagInputChange}
                    className="w-16 h-10 p-1"
                  />
                  <div className="flex-1">
                    <Input
                      name="color"
                      value={tagData.color}
                      onChange={handleTagInputChange}
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={updateTagMutation.isPending}>
                {updateTagMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></div>
                    Updating...
                  </div>
                ) : (
                  <>Update Tag</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}