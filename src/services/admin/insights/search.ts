import type { Db } from "./core";

export interface SearchHit {
  type: "user" | "place" | "destination";
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  href: string;
}

/** חיפוש גלובלי ל-⌘K: משתמשים (שם/username/אימייל), מקומות ויעדים. */
export async function globalSearch(db: Db, raw: string): Promise<SearchHit[]> {
  const q = raw.trim().replace(/[%,()]/g, " ").trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;

  const [profiles, places, destinations, auth] = await Promise.all([
    db.from("profiles").select("id,full_name,username,avatar_url,city").or(`full_name.ilike.${like},username.ilike.${like}`).limit(6),
    db.from("places").select("id,name,city,country,image_urls,is_legacy").ilike("name", like).order("is_legacy").limit(8),
    db.from("destinations").select("id,name,country,image_url").ilike("name", like).limit(5),
    q.includes("@") || /^[0-9a-f-]{8,}$/i.test(q) ? db.auth.admin.listUsers({ perPage: 1000 }) : Promise.resolve(null),
  ]);

  const hits: SearchHit[] = [];
  const seenUsers = new Set<string>();
  for (const p of (profiles.data ?? []) as { id: string; full_name: string | null; username: string | null; avatar_url: string | null; city: string | null }[]) {
    seenUsers.add(p.id);
    hits.push({
      type: "user",
      id: p.id,
      title: p.full_name || (p.username ? `@${p.username}` : p.id.slice(0, 8)),
      subtitle: [p.username ? `@${p.username}` : null, p.city].filter(Boolean).join(" · "),
      imageUrl: p.avatar_url,
      href: `/admin/users?user=${p.id}`,
    });
  }
  const lower = q.toLowerCase();
  for (const u of auth?.data?.users ?? []) {
    if (seenUsers.has(u.id)) continue;
    if ((u.email ?? "").toLowerCase().includes(lower) || u.id.startsWith(lower)) {
      hits.push({ type: "user", id: u.id, title: u.email ?? u.id.slice(0, 8), subtitle: "חשבון", imageUrl: null, href: `/admin/users?user=${u.id}` });
      if (hits.filter((h) => h.type === "user").length >= 8) break;
    }
  }
  for (const p of (places.data ?? []) as { id: string; name: string; city: string | null; country: string | null; image_urls: string[] | null; is_legacy: boolean | null }[]) {
    hits.push({
      type: "place",
      id: p.id,
      title: p.name,
      subtitle: [p.city, p.country, p.is_legacy ? "ארכיון" : null].filter(Boolean).join(" · "),
      imageUrl: p.image_urls?.[0] ?? null,
      href: `/admin/places/${p.id}`,
    });
  }
  for (const d of (destinations.data ?? []) as { id: string; name: string; country: string | null; image_url: string | null }[]) {
    hits.push({ type: "destination", id: d.id, title: d.name, subtitle: d.country ?? "", imageUrl: d.image_url, href: `/admin/destinations?q=${encodeURIComponent(d.name)}` });
  }
  return hits;
}
