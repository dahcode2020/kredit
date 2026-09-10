"use client";
import { create } from "zustand";
type User = { id: string; email: string; role: "CUSTOMER"|"ADMIN"|"SUPER_ADMIN"; locale: string };
type AuthState = { user: User|null; accessToken: string|null; login:(u:User,t:string)=>void; logout:()=>void };
export const useAuth = create<AuthState>((set)=>({
  user:null, accessToken:null,
  login:(user, accessToken)=> set({user, accessToken}),
  logout:()=> set({user:null, accessToken:null}),
}));
