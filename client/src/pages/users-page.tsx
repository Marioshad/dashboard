import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, ArrowUpDown } from "lucide-react";
import { User, Role } from "@shared/schema";

interface UserWithRole extends User {
  role?: Role;
}

export default function UsersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<keyof UserWithRole>("username");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const isAdmin = user?.roleId === 1 || user?.roleId === 2; // Superadmin or Admin

  const { data: users, isLoading } = useQuery<UserWithRole[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });

  // Apply filtering, sorting, and pagination
  const filteredUsers = users?.filter(user =>
    Object.values(user).some(value =>
      String(value).toLowerCase().includes(search.toLowerCase())
    )
  ) || [];

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    const comparison = String(aValue).localeCompare(String(bValue));
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const paginatedUsers = sortedUsers.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const totalPages = Math.ceil(sortedUsers.length / perPage);

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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage user accounts and roles
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Users List</CardTitle>
            <CardDescription>
              View and manage all users in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      className="pl-8"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            if (sortField === "username") {
                              setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                            } else {
                              setSortField("username");
                              setSortDirection("asc");
                            }
                          }}
                        >
                          Username
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : paginatedUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.fullName}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {user.role ? (
                              <Badge variant="secondary">
                                {user.role.name}
                              </Badge>
                            ) : (
                              <Badge variant="outline">No Role</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {((page - 1) * perPage) + 1} to{" "}
                  {Math.min(page * perPage, sortedUsers.length)} of{" "}
                  {sortedUsers.length} users
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
