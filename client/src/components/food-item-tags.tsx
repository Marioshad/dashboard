import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tag, FoodItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TagIcon, X, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface FoodItemTagsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foodItem: FoodItem | null;
}

export function FoodItemTags({ open, onOpenChange, foodItem }: FoodItemTagsProps) {
  const { toast } = useToast();
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Reset selected tags when dialog opens with a different food item
  useEffect(() => {
    if (open && foodItem) {
      // We'll load the food item's tags when the component mounts
      setSelectedTags([]);
    }
  }, [open, foodItem]);
  
  // Get all available tags
  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
    queryFn: async () => {
      return await apiRequest("/api/tags") as Tag[];
    },
  });
  
  // Get tags for the specific food item
  const { data: foodItemTags = [], isLoading: tagsLoading } = useQuery<Tag[]>({
    queryKey: ["/api/food-items", foodItem?.id, "tags"],
    queryFn: async () => {
      if (!foodItem) return [];
      return await apiRequest(`/api/food-items/${foodItem.id}/tags`) as Tag[];
    },
    enabled: !!foodItem,
  });
  
  // Update selected tags when foodItemTags changes
  useEffect(() => {
    if (foodItemTags && foodItemTags.length > 0) {
      setSelectedTags(foodItemTags.map((tag: Tag) => tag.id));
    }
  }, [foodItemTags]);
  
  // Add tag to food item
  const addTagMutation = useMutation({
    mutationFn: async ({ foodItemId, tagId }: { foodItemId: number; tagId: number }) => {
      return await apiRequest(`/api/food-items/${foodItemId}/tags/${tagId}`, {
        method: "POST",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add tag to food item",
        variant: "destructive",
      });
    },
  });
  
  // Remove tag from food item
  const removeTagMutation = useMutation({
    mutationFn: async ({ foodItemId, tagId }: { foodItemId: number; tagId: number }) => {
      return await apiRequest(`/api/food-items/${foodItemId}/tags/${tagId}`, {
        method: "DELETE",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove tag from food item",
        variant: "destructive",
      });
    },
  });
  
  // Handle tag selection
  const handleTagToggle = (tagId: number) => {
    setSelectedTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  };
  
  // Save changes
  const handleSave = async () => {
    if (!foodItem) return;
    
    // Find tags to add and tags to remove
    const currentTagIds = foodItemTags.map((tag: Tag) => tag.id);
    const tagsToAdd = selectedTags.filter((tagId: number) => !currentTagIds.includes(tagId));
    const tagsToRemove = currentTagIds.filter((tagId: number) => !selectedTags.includes(tagId));
    
    // Process all add operations
    for (const tagId of tagsToAdd) {
      await addTagMutation.mutateAsync({ foodItemId: foodItem.id, tagId });
    }
    
    // Process all remove operations
    for (const tagId of tagsToRemove) {
      await removeTagMutation.mutateAsync({ foodItemId: foodItem.id, tagId });
    }
    
    // Refresh tags data
    queryClient.invalidateQueries({ queryKey: ["/api/food-items", foodItem.id, "tags"] });
    
    // Show success message
    if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
      toast({
        title: "Tags updated",
        description: "Food item tags have been updated successfully",
      });
    }
    
    // Close dialog
    onOpenChange(false);
  };
  
  // Filter tags by search query
  const filteredTags = allTags.filter(tag => 
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="h-5 w-5" />
            Manage Tags
          </DialogTitle>
          <DialogDescription>
            {foodItem && (
              <>
                Add or remove tags for <span className="font-medium">{foodItem.name}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        {/* Search input */}
        <div className="my-4">
          <Input 
            placeholder="Search tags..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        
        {/* Current tags */}
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">Selected Tags:</h3>
          <div className="flex flex-wrap gap-2">
            {selectedTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags selected</p>
            ) : (
              allTags
                .filter(tag => selectedTags.includes(tag.id))
                .map(tag => (
                  <Badge 
                    key={tag.id} 
                    variant="outline"
                    className="flex items-center gap-1 px-3 py-1"
                    style={{ 
                      backgroundColor: tag.color ? `${tag.color}20` : undefined, 
                      borderColor: tag.color || undefined 
                    }}
                  >
                    <span className="text-sm">{tag.name}</span>
                    <button 
                      onClick={() => handleTagToggle(tag.id)}
                      className="h-4 w-4 rounded-full inline-flex items-center justify-center hover:bg-background/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
            )}
          </div>
        </div>
        
        {/* Available tags */}
        <div className="max-h-[300px] overflow-y-auto border rounded-md p-3">
          <h3 className="text-sm font-medium mb-2">Available Tags:</h3>
          {tagsLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            </div>
          ) : filteredTags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No matching tags found</p>
          ) : (
            <div className="space-y-2">
              {filteredTags.map(tag => (
                <div key={tag.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`tag-${tag.id}`} 
                    checked={selectedTags.includes(tag.id)}
                    onCheckedChange={() => handleTagToggle(tag.id)}
                  />
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: tag.color || '#3B82F6' }}
                  ></div>
                  <Label 
                    htmlFor={`tag-${tag.id}`}
                    className="flex-1 text-sm"
                  >
                    {tag.name}
                    {tag.isSystem === true && (
                      <span className="ml-2 text-xs text-muted-foreground">(System)</span>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={addTagMutation.isPending || removeTagMutation.isPending}
          >
            {(addTagMutation.isPending || removeTagMutation.isPending) ? (
              <div className="flex items-center">
                <div className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></div>
                Saving...
              </div>
            ) : (
              <>Save Changes</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}