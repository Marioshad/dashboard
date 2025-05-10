import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, X, RefreshCw, DatabaseIcon, CreditCard, Zap, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Define status interface
interface SystemStatus {
  database: {
    connected: boolean;
    version: string;
    lastPing: string;
  };
  stripe: {
    connected: boolean;
    apiVersion: string;
    productsCount: number;
    pricesCount: number;
  };
  openai: {
    connected: boolean;
    availableModels: string;
    defaultModel: string;
  };
  env: Array<{
    name: string;
    exists: boolean;
    description: string;
  }>;
}

export default function SystemPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshingDb, setRefreshingDb] = useState(false);
  const [checkingServices, setCheckingServices] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    database: {
      connected: false,
      version: '',
      lastPing: '',
    },
    stripe: {
      connected: false,
      apiVersion: '',
      productsCount: 0,
      pricesCount: 0,
    },
    openai: {
      connected: false,
      availableModels: '',
      defaultModel: '',
    },
    env: [],
  });

  // Fetch system status
  useEffect(() => {
    const fetchStatus = async () => {
      setIsLoading(true);
      try {
        // Use fetch directly for more control
        const response = await fetch('/api/admin/system/status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setSystemStatus(data);
      } catch (error) {
        console.error('Error fetching system status:', error);
        toast({
          title: 'Error',
          description: 'Failed to load system status',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, [toast]);

  // Refresh database connection
  const refreshDbConnection = async () => {
    setRefreshingDb(true);
    try {
      // Use fetch directly for more control
      const response = await fetch('/api/admin/system/refresh-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Update only database section of the status
        setSystemStatus(prev => ({
          ...prev,
          database: {
            ...prev.database,
            connected: data.connected,
            version: data.version,
            lastPing: new Date().toISOString(),
          }
        }));
        
        toast({
          title: 'Success',
          description: 'Database connection refreshed successfully',
          variant: 'default',
        });
      } else {
        throw new Error(data.message || 'Failed to refresh database connection');
      }
    } catch (error: any) {
      console.error('Error refreshing database connection:', error);
      
      // Update database status to show failed connection
      setSystemStatus(prev => ({
        ...prev,
        database: {
          ...prev.database,
          connected: false,
          lastPing: new Date().toISOString(),
        }
      }));
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to refresh database connection',
        variant: 'destructive',
      });
    } finally {
      setRefreshingDb(false);
    }
  };

  // Check external services
  const checkServices = async () => {
    setCheckingServices(true);
    try {
      // Use fetch directly for more control
      const response = await fetch('/api/admin/system/check-services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Update services status
        setSystemStatus(prev => {
          const { database, stripe, openai } = data.services;
          
          return {
            ...prev,
            database: {
              ...prev.database,
              connected: database.connected,
              lastPing: new Date().toISOString(),
            },
            stripe: {
              ...prev.stripe,
              connected: stripe.connected,
            },
            openai: {
              ...prev.openai,
              connected: openai.connected,
            },
          };
        });
        
        toast({
          title: 'Success',
          description: 'Services checked successfully',
          variant: 'default',
        });
      } else {
        throw new Error(data.message || 'Failed to check services');
      }
    } catch (error: any) {
      console.error('Error checking services:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to check services',
        variant: 'destructive',
      });
    } finally {
      setCheckingServices(false);
    }
  };

  // Format database last ping time
  const formatLastPing = (isoDate: string) => {
    if (!isoDate) return 'Never';
    
    try {
      const date = new Date(isoDate);
      return date.toLocaleString();
    } catch (error) {
      return isoDate;
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>
              View and manage the current status of your application's components and integrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-48">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <Tabs defaultValue="database">
                <TabsList className="grid grid-cols-3 mb-8">
                  <TabsTrigger value="database">
                    <DatabaseIcon className="mr-2 h-4 w-4" />
                    Database
                  </TabsTrigger>
                  <TabsTrigger value="services">
                    <CreditCard className="mr-2 h-4 w-4" />
                    External Services
                  </TabsTrigger>
                  <TabsTrigger value="environment">
                    <Server className="mr-2 h-4 w-4" />
                    Environment
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="database">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Database Connection</CardTitle>
                        <Badge variant={systemStatus.database.connected ? "default" : "destructive"}>
                          {systemStatus.database.connected ? 'Connected' : 'Disconnected'}
                        </Badge>
                      </div>
                      <CardDescription>
                        PostgreSQL database connection status and details
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h3 className="text-sm font-medium">Version</h3>
                            <p className="text-sm">{systemStatus.database.version || 'Unknown'}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium">Last Check</h3>
                            <p className="text-sm">{formatLastPing(systemStatus.database.lastPing)}</p>
                          </div>
                        </div>
                        
                        <Button 
                          onClick={refreshDbConnection} 
                          disabled={refreshingDb}
                          variant="outline"
                          className="w-full md:w-auto"
                        >
                          {refreshingDb ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Refreshing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Refresh Connection
                            </>
                          )}
                        </Button>
                        
                        {!systemStatus.database.connected && (
                          <Alert variant="destructive" className="mt-4">
                            <X className="h-4 w-4" />
                            <AlertTitle>Database Connection Error</AlertTitle>
                            <AlertDescription>
                              The application cannot connect to the database. Check your database credentials and ensure the database server is running.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="services">
                  <Card>
                    <CardHeader>
                      <CardTitle>External Services</CardTitle>
                      <CardDescription>
                        Status of third-party service integrations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-8">
                        {/* Stripe Service */}
                        <div>
                          <div className="flex items-center mb-4">
                            <h3 className="text-lg font-medium flex-1">Stripe Payment Processing</h3>
                            <Badge variant={systemStatus.stripe.connected ? "default" : "destructive"}>
                              {systemStatus.stripe.connected ? 'Connected' : 'Disconnected'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <h4 className="text-sm font-medium">API Version</h4>
                              <p className="text-sm">{systemStatus.stripe.apiVersion || 'Unknown'}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium">Products</h4>
                              <p className="text-sm">{systemStatus.stripe.productsCount}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium">Price Plans</h4>
                              <p className="text-sm">{systemStatus.stripe.pricesCount}</p>
                            </div>
                          </div>
                          
                          {!systemStatus.stripe.connected && (
                            <Alert variant="destructive">
                              <X className="h-4 w-4" />
                              <AlertTitle>Stripe Connection Error</AlertTitle>
                              <AlertDescription>
                                The application cannot connect to Stripe. Check your API keys and ensure they are valid.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                        
                        {/* OpenAI Service */}
                        <div>
                          <div className="flex items-center mb-4">
                            <h3 className="text-lg font-medium flex-1">OpenAI AI Services</h3>
                            <Badge variant={systemStatus.openai.connected ? "default" : "destructive"}>
                              {systemStatus.openai.connected ? 'Connected' : 'Disconnected'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <h4 className="text-sm font-medium">Default Model</h4>
                              <p className="text-sm">{systemStatus.openai.defaultModel || 'None'}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium">Available Models</h4>
                              <p className="text-sm">{systemStatus.openai.availableModels || '0'}</p>
                            </div>
                          </div>
                          
                          {!systemStatus.openai.connected && (
                            <Alert variant="destructive">
                              <X className="h-4 w-4" />
                              <AlertTitle>OpenAI Connection Error</AlertTitle>
                              <AlertDescription>
                                The application cannot connect to OpenAI. Check your API key and ensure it is valid.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                        
                        <Button 
                          onClick={checkServices} 
                          disabled={checkingServices}
                          variant="outline"
                          className="w-full md:w-auto"
                        >
                          {checkingServices ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Checking...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Check All Services
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="environment">
                  <Card>
                    <CardHeader>
                      <CardTitle>Environment Variables</CardTitle>
                      <CardDescription>
                        Check which environment variables are configured
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Variable</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {systemStatus.env.map((variable, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono text-sm">
                                {variable.name}
                              </TableCell>
                              <TableCell>
                                {variable.exists ? (
                                  <div className="flex items-center">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                                    <span>Set</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center">
                                    <X className="h-4 w-4 text-red-500 mr-2" />
                                    <span>Missing</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{variable.description}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}