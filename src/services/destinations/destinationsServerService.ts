import { createClient } from "@/services/supabase/server";

export interface Destination {
  id: string;
  name: string;
  country: string;
  description: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** לשימוש ב-Server Components בלבד. */
export async function getDestinationById(id: string): Promise<Destination | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("destinations").select("*").eq("id", id).maybeSingle();
  return data;
}
