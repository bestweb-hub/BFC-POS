import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    let errorMessage = res.statusText;
    
    // Try to parse JSON error response
    try {
      const json = JSON.parse(text);
      if (json.error) {
        errorMessage = json.error;
      }
    } catch {
      // If not JSON, use the text as is
      errorMessage = text || res.statusText;
    }
    
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL from queryKey, handling objects as query parameters
    let url = "";
    const params = new URLSearchParams();
    
    for (const part of queryKey) {
      if (typeof part === "string") {
        // If we already have a URL, this might be a path segment
        if (url && !url.startsWith("/")) {
          url = part;
        } else if (!url) {
          url = part;
        } else {
          // Multiple string parts - join them
          url = url.endsWith("/") ? `${url}${part}` : `${url}/${part}`;
        }
      } else if (typeof part === "object" && part !== null && !Array.isArray(part)) {
        // Handle objects as query parameters
        for (const [key, value] of Object.entries(part)) {
          if (value !== undefined && value !== null && value !== "") {
            params.append(key, String(value));
          }
        }
      }
    }
    
    // Append query parameters if any
    const queryString = params.toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
