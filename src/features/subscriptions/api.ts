import { supabase } from "@/lib/supabase";
import type { Entitlements, Plan } from "./types";

export const fetchEntitlements = async (): Promise<Entitlements | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_my_entitlements");
  if (error) throw error;
  return data as Entitlements;
};

export const fetchPlans = async (): Promise<Plan[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, price_cents, currency, sort_order, limits")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Plan[];
};
