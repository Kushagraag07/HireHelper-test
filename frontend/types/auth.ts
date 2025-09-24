export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface SignupData {
  email: string;
  name: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  user: User;
}