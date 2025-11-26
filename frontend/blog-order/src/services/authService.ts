import type { LoginRequest, LoginResponse, Admin } from '../types/auth';

const normalizeBaseUrl = (url?: string) => {
  if (!url) {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
  const trimmed = url.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
};

const API_HOST = normalizeBaseUrl(import.meta.env.VITE_REACT_APP_API_URL);
const API_VERSION = import.meta.env.VITE_REACT_APP_API_VERSION || "1";

const API_BASE = `${API_HOST}/v${API_VERSION}/auth`;
// Login
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Login failed');
  }
  
  const data = await res.json();
  
  // Store token in localStorage
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('adminData', JSON.stringify(data.admin));
  }
  
  return data;
}

// Logout
export async function logout(): Promise<void> {
  const token = getAuthToken();
  
  if (token) {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
    } catch (error) {
      console.warn('Logout request failed:', error);
    }
  }
  
  // Clear local storage
  localStorage.removeItem('authToken');
  localStorage.removeItem('adminData');
}

// Get stored auth token
export function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

// Get stored admin data
export function getAdminData(): Admin | null {
  const adminData = localStorage.getItem('adminData');
  return adminData ? JSON.parse(adminData) : null;
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    // Basic JWT expiration check
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp > currentTime;
  } catch {
    return false;
  }
}

// Get all admins (protected route)
export async function getAllAdmins(): Promise<Admin[]> {
  const token = getAuthToken();
  if (!token) throw new Error('No authentication token');
  
  const res = await fetch(`${API_BASE}/admins`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to get admins');
  }
  
  const data = await res.json();
  return data.admins;
}

// Create new admin (protected route)
export async function createAdmin(adminData: Omit<Admin, 'id' | 'created_at' | 'last_login'> & { password: string }): Promise<Admin> {
  const token = getAuthToken();
  if (!token) throw new Error('No authentication token');
  
  const res = await fetch(`${API_BASE}/admins`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(adminData),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to create admin');
  }
  
  const data = await res.json();
  return data.admin;
}

// Update admin (protected route)
export async function updateAdmin(id: string, adminData: Partial<Admin & { password?: string }>): Promise<Admin> {
  const token = getAuthToken();
  if (!token) throw new Error('No authentication token');
  
  const res = await fetch(`${API_BASE}/admins/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(adminData),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to update admin');
  }
  
  const data = await res.json();
  return data.admin;
}

// Delete admin (protected route)
export async function deleteAdmin(id: string): Promise<void> {
  const token = getAuthToken();
  if (!token) throw new Error('No authentication token');
  
  const res = await fetch(`${API_BASE}/admins/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to delete admin');
  }
}