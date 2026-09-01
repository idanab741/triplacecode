"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SuggestedTravelerDto } from "@/services/social/suggestedTravelersService";

interface SuggestedPeopleCirclesProps {
  people: SuggestedTravelerDto[];
}

/** מספר עיגולים ריקים (placeholder) שמוצגים בנוסף לאנשים האמיתיים,
 *  כדי שהשורה תיראה מלאה גם כשעדיין אין הרבה הצעות אמיתיות ב-DB. */
const EMPTY_PLACEHOLDER_COUNT = 3;

/** גודל כל עיגול וכמה הם חופפים אחד את השני (בקשה מפורשת: "להקטין
 *  את הגובה ואת העיגולים" + "שכל העיגולים יהיו מצופפים אחד על השני"). */
const CIRCLE_SIZE = 42;
const OVERLAP = 16;

const DISMISS_KEY = "triplace_suggested_people_dismissed";

/** "אולי תתעניין באנשים הבאים" - ערימת עיגולים חופפים (facepile), בין
 *  הסטורי ל-"עבורך/חברים". טריפי ראשון, אחריו עיגולים ריקים, ובסוף
 *  אייקון ה-"+" הסגול הקיים (places-plus-icon.png - בקשה מפורשת: "מה
 *  ששלחתי עכשיו, לא מה שיש שם בפועל"). ניתן לסגור את כל הבלוק עם X
 *  למעלה בצד שמאל (נשמר ב-localStorage כדי שלא יחזור אחרי סגירה). */
export function SuggestedPeopleCircles({ people }: SuggestedPeopleCirclesProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <section className="relative border-t border-ink-secondary/10 ps-4 py-2">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="סגור"
        className="absolute end-2 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-ink-secondary"
      >
        ✕
      </button>

      <h3 className="mb-2 pe-8 text-[13px] font-bold text-ink">אולי תתעניין באנשים הבאים</h3>

      <div className="flex overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {people.map((person, i) => (
          <PersonCircle key={person.id} person={person} overlap={i > 0} />
        ))}

        {Array.from({ length: EMPTY_PLACEHOLDER_COUNT }).map((_, i) => (
          <EmptyCircle key={`empty-${i}`} />
        ))}

        <Link href="/places/search" className="shrink-0 transition-transform active:scale-95" style={{ marginInlineStart: -OVERLAP }}>
          <Image
            src="/images/places-plus-icon.png"
            alt="עוד"
            width={CIRCLE_SIZE}
            height={CIRCLE_SIZE}
            className="rounded-full border-2 border-white"
          />
        </Link>
      </div>
    </section>
  );
}

function PersonCircle({ person, overlap }: { person: SuggestedTravelerDto; overlap: boolean }) {
  return (
    <Link
      href={`/places/profile/${person.username ?? person.id}`}
      className="shrink-0 overflow-hidden rounded-full border-2 border-white bg-bg-secondary transition-transform active:scale-95"
      style={{ height: CIRCLE_SIZE, width: CIRCLE_SIZE, marginInlineStart: overlap ? -OVERLAP : 0 }}
    >
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-sm font-extrabold text-white"
          style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }}
        >
          {person.fullName?.[0] ?? "?"}
        </span>
      )}
    </Link>
  );
}

function EmptyCircle() {
  return (
    <div
      className="shrink-0 rounded-full border-2 border-white bg-ink-secondary/10"
      style={{ height: CIRCLE_SIZE, width: CIRCLE_SIZE, marginInlineStart: -OVERLAP }}
    />
  );
}
