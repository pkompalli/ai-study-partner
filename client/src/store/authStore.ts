import { create } from 'zustand';
// import api from '@/lib/api';

interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  init: () => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

// AUTH DISABLED — init sets a fixed dev user so the app skips the login screen.
// Re-enable by swapping the init/signUp/signIn/signOut bodies below.
const DEV_USER: AuthUser = { id: 'dev-user', email: 'dev@localhost', name: 'Dev User' };

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    set({ user: DEV_USER, loading: false });

    // --- real auth (uncomment to re-enable) ---
    // const token = localStorage.getItem('token');
    // if (!token) { set({ loading: false }); return; }
    // try {
    //   const { data } = await api.get<{ user: AuthUser }>('/api/auth/me');
    //   set({ user: data.user, loading: false });
    // } catch {
    //   localStorage.removeItem('token');
    //   set({ user: null, loading: false });
    // }
  },

  signUp: async (_email, _password, _name) => {
    set({ user: DEV_USER });

    // --- real auth (uncomment to re-enable) ---
    // const { data } = await api.post<{ token: string; user: AuthUser }>('/api/auth/signup', { email, password, name });
    // localStorage.setItem('token', data.token);
    // set({ user: data.user });
  },

  signIn: async (_email, _password) => {
    set({ user: DEV_USER });

    // --- real auth (uncomment to re-enable) ---
    // const { data } = await api.post<{ token: string; user: AuthUser }>('/api/auth/signin', { email, password });
    // localStorage.setItem('token', data.token);
    // set({ user: data.user });
  },

  signOut: () => {
    set({ user: null });

    // --- real auth (uncomment to re-enable) ---
    // localStorage.removeItem('token');
  },
}));
