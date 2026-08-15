// ApiClient - Centralized API layer ready for backend connection
// Currently uses localStorage as mock backend

import { storage } from '../utils/StorageAdapter';
import { NetworkError } from '../types/errors';
import { TIMING } from '../config/timing';

interface FetchOptions extends RequestInit {
    timeout?: number;
}

interface ApiResponse<T> {
    data: T;
    status: number;
    ok: boolean;
}

class ApiClient {
    private baseUrl: string;
    private token: string | null = null;

    constructor(baseUrl: string = '/api') {
        this.baseUrl = baseUrl;
    }

    setAuthToken(token: string | null) {
        this.token = token;
    }

    private async request<T>(
        endpoint: string,
        options: FetchOptions = {}
    ): Promise<ApiResponse<T>> {
        const { timeout = 10000, ...fetchOptions } = options;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> || {}),
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        // In production, this would be a real fetch
        // For now, simulate with localStorage
        const isLocalMode = this.baseUrl === '/api';

        if (isLocalMode) {
            return this.mockRequest<T>(endpoint, { ...fetchOptions, headers });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...fetchOptions,
                headers,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new NetworkError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    endpoint
                );
            }

            const data = await response.json();
            return { data, status: response.status, ok: true };
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof NetworkError) throw error;
            throw new NetworkError(String(error), undefined, endpoint);
        }
    }

    // Mock implementation using localStorage
    private async mockRequest<T>(
        endpoint: string,
        options: FetchOptions
    ): Promise<ApiResponse<T>> {
        await new Promise(resolve => setTimeout(resolve, TIMING.API_CLIENT_MOCK_LATENCY_MS)); // Simulate latency

        const method = options.method || 'GET';
        const storageKey = endpoint.replace(/^\//, '').replace(/\//g, '_');

        switch (method) {
            case 'GET': {
                const data = await storage.get<T>(storageKey);
                return { data: data as T, status: data ? 200 : 404, ok: !!data };
            }
            case 'POST':
            case 'PUT': {
                const body = options.body ? JSON.parse(options.body as string) : {};
                await storage.set(storageKey, body);
                return { data: body as T, status: method === 'POST' ? 201 : 200, ok: true };
            }
            case 'DELETE': {
                await storage.remove(storageKey);
                return { data: {} as T, status: 204, ok: true };
            }
            default:
                return { data: {} as T, status: 405, ok: false };
        }
    }

    // Convenience methods
    async get<T>(endpoint: string): Promise<T> {
        const response = await this.request<T>(endpoint, { method: 'GET' });
        return response.data;
    }

    async post<T>(endpoint: string, data: unknown): Promise<T> {
        const response = await this.request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        return response.data;
    }

    async put<T>(endpoint: string, data: unknown): Promise<T> {
        const response = await this.request<T>(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        return response.data;
    }

    async delete(endpoint: string): Promise<void> {
        await this.request(endpoint, { method: 'DELETE' });
    }
}

// Singleton export
export const apiClient = new ApiClient();

// For connecting to real backend later:
// export const apiClient = new ApiClient('https://api.talentsonar.com');
