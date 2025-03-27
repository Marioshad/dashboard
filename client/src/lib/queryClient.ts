import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    console.error(`Response error: ${res.status}`, text);
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options?: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  }
): Promise<any> {
  console.log(`Making API request to ${options?.method || 'GET'}`, url);
  console.log("Request headers:", JSON.stringify(options?.headers || {}));
  console.log("Request body:", options?.body || "none");
  
  const res = await fetch(url, {
    method: options?.method || 'GET',
    headers: options?.headers || {},
    body: options?.body,
    credentials: "include",
  });

  console.log(`Response status: ${res.status}`);
  // Log some important response headers
  console.log(`Response headers: content-type=${res.headers.get('content-type')}, cache-control=${res.headers.get('cache-control')}`);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`API error: ${res.status}`, errorText);
    throw new Error(`${res.status}: ${errorText || res.statusText}`);
  }
  
  const data = await res.json();
  console.log(`API response data:`, data);
  return data;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    console.log(`Query fetch: ${queryKey[0]}`);
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });
    
    console.log(`Query response status: ${res.status}`);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log("Returning null for unauthorized request (401)");
      return null;
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Query error: ${res.status}`, errorText);
      throw new Error(`${res.status}: ${errorText || res.statusText}`);
    }
    
    const data = await res.json();
    console.log(`Query response data:`, data);
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
