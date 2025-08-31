export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  expiresIn: string;
  admin: Admin;
}

export interface Admin {
  id: string;
  email: string;
  name: string;
  created_at?: string;
  last_login?: string;
  updated_at?: string;
}