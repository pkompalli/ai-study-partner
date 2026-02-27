'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'

interface AuthUser {
  id: string
  email: string
  name?: string | null
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  init: () => Promise<void>
  signUp: (email: string, password: string, name?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    set({
      user: user ? { id: user.id, email: user.email!, name: user.user_metadata?.name } : null,
      loading: false,
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      set({ user: u ? { id: u.id, email: u.email!, name: u.user_metadata?.name } : null })
    })
  },

  signUp: async (email, password, name) => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } },
    })
    if (error) throw error
    const u = data.user!
    set({ user: { id: u.id, email: u.email!, name } })
  },

  signIn: async (email, password) => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const u = data.user
    set({ user: { id: u.id, email: u.email!, name: u.user_metadata?.name } })
  },

  signOut: async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    set({ user: null })
  },
}))
