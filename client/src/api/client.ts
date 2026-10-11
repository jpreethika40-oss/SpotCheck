// HTTP API client with auth token headers, cookie support, and error normalization

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

class ApiClient {
  private baseUrl = '/api/v1';

  private getToken(): string | null {
    return localStorage.getItem('spotcheck_token');
  }

  public setToken(token: string | null) {
    if (token) {
      localStorage.setItem('spotcheck_token', token);
    } else {
      localStorage.removeItem('spotcheck_token');
    }
  }

  private async request<T = any>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = path.startsWith('/api') ? path : `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Support HttpOnly cookies alongside Authorization header
      });

      if (response.status === 204) {
        return { success: true };
      }

      // Check if response is a file download
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/csv') || contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
        const blob = await response.blob();
        return { success: true, data: blob as any };
      }

      const json = await response.json();

      if (!response.ok) {
        // Handle 401 unauth session expiry
        if (response.status === 401 && !path.includes('/auth/login')) {
          // Token expired or invalid
          console.warn('Unauthorized request - session may be expired');
        }
        return {
          success: false,
          error: json.error || {
            code: `HTTP_${response.status}`,
            message: json.message || response.statusText,
          },
        };
      }

      return json;
    } catch (err: any) {
      // Offline or network error
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Network request failed. You may be offline.',
        },
      };
    }
  }

  public get<T = any>(path: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    let url = path;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, String(val));
        }
      });
      const query = searchParams.toString();
      if (query) url += `?${query}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  public post<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  public put<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  public patch<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  public delete<T = any>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
