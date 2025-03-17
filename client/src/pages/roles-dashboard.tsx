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
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { Role, Permission } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

const COLORS = [
  '#8884d8', // Primary color
  '#82ca9d', // Success color
  '#ffc658', // Warning color
  '#ff8042', // Danger color
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-white p-4 rounded-lg shadow-lg border">
      <p className="font-semibold">{data.name}</p>
      {data.description && (
        <p className="text-sm text-muted-foreground">{data.description}</p>
      )}
      {data.permissionCount && (
        <p className="text-sm mt-2">
          {data.permissionCount} permission{data.permissionCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
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

  const treeMapData = roles?.map((role, index) => ({
    name: role.name,
    size: role.permissions.length,
    permissionCount: role.permissions.length,
    description: role.description,
    fill: COLORS[index % COLORS.length],
    children: role.permissions.map(perm => ({
      name: perm.name,
      size: 1,
      description: perm.description,
      fill: COLORS[index % COLORS.length],
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
                  <Treemap
                    data={treeMapData}
                    dataKey="size"
                    ratio={4/3}
                    stroke="#fff"
                    fill="#8884d8"
                    content={({ x, y, width, height, index, name }) => {
                      const fill = COLORS[index % COLORS.length];
                      return (
                        <motion.g
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                        >
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            fill={fill}
                            stroke="#fff"
                            strokeWidth={2}
                          />
                          <text
                            x={x + width / 2}
                            y={y + height / 2}
                            textAnchor="middle"
                            fill="#fff"
                            fontSize={12}
                            style={{
                              pointerEvents: 'none',
                              textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                            }}
                          >
                            {name}
                          </text>
                        </motion.g>
                      );
                    }}
                  >
                    <Tooltip content={<CustomTooltip />} />
                  </Treemap>
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
                  transition={{ duration: 0.3, delay: index * 0.1 }}
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