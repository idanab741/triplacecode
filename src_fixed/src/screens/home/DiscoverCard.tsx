"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";

import "swiper/css";
import "swiper/css/pagination";

import { SurpriseMeSection } from "@/screens/home/SurpriseMeSection";
import { PlacesPasswordModal } from "@/screens/home/PlacesPasswordModal";

type Slide =
  | { kind: "link"; href: string; image: string; alt: string }
  | { kind: "places"; image: string; alt: string }
  | { kind: "surprise" };

/**
 * תיקון Product מפורש ("אפשר שהחלק הזה יופיע ב'גלה עוד'?"): שקופית
 * "בא לכם לצאת עכשיו?" (SurpriseMeSection, variant="embedded") הועברה
 * לכאן מסקשן עצמאי בעמוד הבית - ראשונה ברשימה. בשונה משאר השקופיות
 * (תמונה סטטית + ניווט ב-href), זו שקופית **אינטראקטיבית** עם הלוגיקה
 * שלה (מבקשת מיקום, בוחרת מקום רנדומלי ומנווטת) - ולכן הקליק עליה
 * מטופל ע"י הכפתור הפנימי שלה, לא ע"י handleClick הכללי של ה-Swiper
 * (ר' למטה - מדלג עליה כי אין לה href).
 *
 * תיקון (בקשה מפורשת - "להעלים את הכפתור place's מדף הבית ולהעביר
 * אותו לכרטיסייה של places כאן"): שקופית ה-place's (שקישרה בעבר
 * ל-/community, עמוד "בקרוב" נפרד) עברה ל-kind="places" ומקשרת עכשיו
 * בפועל ל-/places - אבל דרך שער סיסמה (PlacesPasswordModal), לא ניווט
 * ישיר כמו שאר השקופיות. ה-banner העצמאי הישן (PlacesEntryBanner)
 * הוסר לגמרי מדף הבית - זו נקודת הכניסה היחידה שנשארה ל-place's.
 */
const SLIDES: Slide[] = [
  { kind: "surprise" },
  {
    kind: "link",
    href: "/deals",
    image: "/images/discover/discover-triplacedeals.png",
    alt: "TripLace Deals - הדילים והמבצעים המשתלמים ביותר עבורכם",
  },
  {
    kind: "places",
    image: "/images/discover/discover-places-social.png",
    alt: "Place's - משתפים, יוצאים לדרך",
  },
  {
    kind: "link",
    href: "/test-game",
    image: "/images/discover/discover-runtrippy.png",
    alt: "RunTrippy - המשחק שלנו",
  },
];

interface DiscoverCardProps {
  /** "home" (בקשה מפורשת - קטע "גלה עוד ב-triplace" בעמוד הבית): בלי הכותרת
   *  הפנימית (הכותרת באה מ-HomeSectionHeader עם האייקון והלוגו) ובאותם
   *  שוליים (px-5) כמו שאר הקטעים שם. ברירת המחדל - כמו קודם, בלי שינוי. */
  variant?: "default" | "home";
}

export function DiscoverCard({ variant = "default" }: DiscoverCardProps = {}) {
  const router = useRouter();
  // *** בקשה מפורשת (קטע "גלה עוד" בעמוד הבית): רק RunTrippy ו"תפתיעו אותי".
  // בשאר השימושים - כל השקופיות, כמו קודם.
  const slides =
    variant === "home"
      ? SLIDES.filter((s) => s.kind === "surprise" || (s.kind === "link" && s.href === "/test-game")).sort(
          (a, b) => (a.kind === "link" ? 0 : 1) - (b.kind === "link" ? 0 : 1)
        )
      : SLIDES;
  // *** שער הסיסמה ל-place's (ר' תיעוד למעלה ליד SLIDES): נפתח בלחיצה
  // על שקופית ה-places במקום ניווט מיידי. לא נשמר בין ביקורים בכוונה -
  // כל לחיצה פותחת מופע חדש של המודאל, בלי לזכור סיסמה קודמת שהוזנה.
  const [showPlacesPassword, setShowPlacesPassword] = useState(false);

  // לא ניתן להשתמש כאן ב-next/link רגיל: כש-loop מופעל, Swiper משכפל
  // את אלמנטי הסליידים ב-DOM ישירות (לא דרך React) כדי ליצור לולאה
  // חלקה - לשכפולים האלה אין event handlers מצורפים, אז קליק עליהם
  // (שקורה בפועל רוב הזמן, כי הלולאה מציגה כל הזמן שכפולים) לא עושה
  // כלום. הפתרון: onClick ברמת ה-Swiper עצמו, שמזהה נכון גם שכפולים
  // דרך data-swiper-slide-index (attribute שמצביע תמיד לאינדקס המקורי).
  function handleClick(_swiper: SwiperInstance, event: MouseEvent | TouchEvent | PointerEvent) {
    const target = event.target as HTMLElement | null;
    const slideEl = target?.closest("[data-swiper-slide-index]") as HTMLElement | null;
    const indexAttr = slideEl?.getAttribute("data-swiper-slide-index");
    // בלי loop (שתי שקופיות בעמוד הבית) אין data-swiper-slide-index - נופלים
    // ל-clickedIndex של ה-Swiper עצמו.
    const slideIndex = indexAttr != null ? Number(indexAttr) : _swiper.clickedIndex;
    if (slideIndex == null || Number.isNaN(slideIndex)) return;
    const slide = slides[slideIndex];
    // שקופית "surprise" מטפלת בקליק שלה בעצמה (כפתור פנימי) - אין כאן
    // מה לנווט אליו ברמת ה-Swiper.
    if (!slide) return;
    // שקופית "places" לא מנווטת ישירות - פותחת קודם את שער הסיסמה.
    if (slide.kind === "places") {
      setShowPlacesPassword(true);
      return;
    }
    if (slide.kind !== "link") return;
    router.push(slide.href);
  }

  return (
    <section className={variant === "home" ? "px-5" : "px-6"}>
      {variant !== "home" && (
        <h3 className="mb-3 text-lg font-semibold text-ink">
          עוד בשבילך ב-TRIPLACE
        </h3>
      )}

      <Swiper
        modules={[Autoplay, Pagination]}
        slidesPerView={1}
        spaceBetween={0}
        loop={slides.length > 2}
        rewind={slides.length <= 2}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
        onClick={handleClick}
        className="aspect-[2112/1408] rounded-[30px] shadow-xl"
      >
        {slides.map((slide, i) => (
          <SwiperSlide
            key={slide.kind === "link" ? slide.href : slide.kind === "places" ? "places" : "surprise"}
            className="relative cursor-pointer"
          >
            {slide.kind === "surprise" ? (
              <SurpriseMeSection variant="embedded" />
            ) : (
              <Image src={slide.image} alt={slide.alt} fill sizes="100vw" priority={i === 0} className="object-cover" />
            )}
          </SwiperSlide>
        ))}
      </Swiper>

      {showPlacesPassword && (
        <PlacesPasswordModal
          onClose={() => setShowPlacesPassword(false)}
          onSuccess={() => {
            setShowPlacesPassword(false);
            router.push("/places");
          }}
        />
      )}
    </section>
  );
}
