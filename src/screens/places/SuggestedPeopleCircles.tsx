"use client";

import Link from "next/link";
import type { SuggestedTravelerDto } from "@/services/social/suggestedTravelersService";

interface SuggestedPeopleCirclesProps {
  people: SuggestedTravelerDto[];
}

/** מספר עיגולים ריקים (placeholder) שמוצגים בנוסף לאנשים האמיתיים,
 *  כדי שהשורה תיראה מלאה גם כשעדיין אין הרבה הצעות אמיתיות ב-DB
 *  (בקשה מפורשת: "ועוד עיגולים נוספים ריקים"). */
const EMPTY_PLACEHOLDER_COUNT = 3;

/** "אולי תתעניין באנשים הבאים" - שורת עיגולים אופקית בדיוק בין הסטורי
 *  ל-"עבורך/חברים" (בקשה מפורשת). עיגול ראשון = טריפי (מגיע מאותו
 *  API כמו SuggestedTravelersRow), אחריו עיגולים ריקים כ-placeholder,
 *  ובסוף כפתור "+" יחיד (בלי X בפנים, ורק על הפריט האחרון - בקשה
 *  מפורשת) שמוביל לחיפוש/גילוי אנשים. */
export function SuggestedPeopleCircles({ people }: SuggestedPeopleCirclesProps) {
  if (people.length === 0) return null;

  return (
    <section className="border-t border-ink-secondary/10 px-4 py-3">
      <h3 className="mb-2.5 text-[13px] font-bold text-ink">אולי תתעניין באנשים הבאים</h3>
      <div className="flex gap-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {people.map((person) => (
          <PersonCircle key={person.id} person={person} />
        ))}

        {Array.from({ length: EMPTY_PLACEHOLDER_COUNT }).map((_, i) => (
          <EmptyCircle key={`empty-${i}`} />
        ))}

        <Link
          href="/places/search"
          className="flex w-[62px] shrink-0 flex-col items-center gap-2 transition-transform active:scale-95"
        >
          <span
            className="flex h-[62px] w-[62px] items-center justify-center rounded-full border-2 border-dashed"
            style={{ borderColor: "var(--color-places-purple)" }}
          >
            <span className="text-2xl leading-none" style={{ color: "var(--color-places-purple)" }}>
              +
            </span>
          </span>
          <span className="w-full truncate text-center text-[11px] font-bold text-ink-secondary">עוד</span>
        </Link>
      </div>
    </section>
  );
}

function PersonCircle({ person }: { person: SuggestedTravelerDto }) {
  return (
    <Link
      href={`/places/profile/${person.username ?? person.id}`}
      className="flex w-[62px] shrink-0 flex-col items-center gap-2 transition-transform active:scale-95"
    >
      <span className="h-[62px] w-[62px] overflow-hidden rounded-full bg-bg-secondary">
        {person.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-lg font-extrabold text-white"
            style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }}
          >
            {person.fullName?.[0] ?? "?"}
          </span>
        )}
      </span>
      <span className="w-full truncate text-center text-[11px] font-bold text-ink">
        {person.fullName ?? person.username ?? "מטייל"}
      </span>
    </Link>
  );
}

function EmptyCircle() {
  return (
    <div className="flex w-[62px] shrink-0 flex-col items-center gap-2 opacity-40">
      <span className="h-[62px] w-[62px] rounded-full border-2 border-dashed border-ink-secondary/30" />
      <span className="w-full truncate text-center text-[11px] font-bold text-ink-secondary">&nbsp;</span>
    </div>
  );
}
