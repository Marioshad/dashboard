import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { TreeMap, ResponsiveContainer } from "recharts";
import { Role, Permission } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export default function RolesDashboard() {
  const { data: roles, isLoading } = useQuery<RoleWithPermissions[]>({
    queryKey: ["/api/roles"],
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const treeMapData = roles?.map(role => ({
    name: role.name,
    size: role.permissions.length,
    children: role.permissions.map(perm => ({
      name: perm.name,
      size: 1,
    })),
  }));

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground">
            Visualize the relationship between roles and their permissions
          </p>
        </div>

        <div className="grid gap-6">
          {/* Treemap visualization */}
          <Card>
            <CardHeader>
              <CardTitle>Permission Distribution</CardTitle>
              <CardDescription>
                Visual representation of roles and their associated permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <TreeMap
                    data={treeMapData}
                    dataKey="size"
                    nameKey="name"
                    fill="#8884d8"
                  />
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Animated role cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {roles?.map((role, index) => (
                <motion.div
                  key={role.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>{role.name}</CardTitle>
                      <CardDescription>{role.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <h4 className="font-medium mb-2">Permissions:</h4>
                      <ul className="space-y-1">
                        {role.permissions.map(permission => (
                          <motion.li
                            key={permission.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-sm text-muted-foreground"
                          >
                            {permission.name}
                          </motion.li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
