import type { ReactNode } from "react";

/** קבוצת מידע בסגנון פייסבוק ("Links" / "Contact info"): כותרת קצרה ומודגשת, ומתחתיה שורות
 *  אייקון + טקסט - בלי קופסאות, מסגרות וצ'יפים. */
export function AttractionInfoGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-5 pt-6">
      <h2 className="text-[17px] font-bold text-ink">{title}</h2>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

export function AttractionInfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3.5 py-2.5">
      <span className="mt-px shrink-0 text-ink">{icon}</span>
      <div className="min-w-0 flex-1 text-[15px] leading-snug text-ink">{children}</div>
    </div>
  );
}
