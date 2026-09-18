import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserAddress {
  id: string;
  user_id: string;
  label: string;
  address_text: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
}

export async function listAddresses(supabase: SupabaseClient, userId: string): Promise<UserAddress[]> {
  const { data, error } = await supabase
    .from("user_addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addAddress(
  supabase: SupabaseClient,
  userId: string,
  address: { label: string; address_text: string; city?: string | null; latitude?: number | null; longitude?: number | null; is_default?: boolean }
): Promise<UserAddress> {
  // אם זו הכתובת הראשונה, או שסימנו אותה כברירת מחדל - מבטלים ברירת
  // מחדל קודמת קודם (אין CHECK/unique constraint ל"רק אחת default" ב-DB,
  // אז אוכפים את זה כאן).
  if (address.is_default) {
    await supabase.from("user_addresses").update({ is_default: false }).eq("user_id", userId);
  }
  const { data, error } = await supabase
    .from("user_addresses")
    .insert({ user_id: userId, ...address })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setDefaultAddress(supabase: SupabaseClient, userId: string, addressId: string): Promise<void> {
  await supabase.from("user_addresses").update({ is_default: false }).eq("user_id", userId);
  const { error } = await supabase.from("user_addresses").update({ is_default: true }).eq("id", addressId);
  if (error) throw error;
}

export async function updateAddress(
  supabase: SupabaseClient,
  addressId: string,
  updates: Partial<Pick<UserAddress, "label" | "address_text" | "city" | "latitude" | "longitude">>
): Promise<void> {
  const { error } = await supabase.from("user_addresses").update(updates).eq("id", addressId);
  if (error) throw error;
}

export async function deleteAddress(supabase: SupabaseClient, addressId: string): Promise<void> {
  const { error } = await supabase.from("user_addresses").delete().eq("id", addressId);
  if (error) throw error;
}
