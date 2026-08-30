"use client";

import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";

interface Partner {
  id: string;
  imageUrl: string;
  alt: string;
}

const PLACEHOLDER_PARTNERS: Partner[] = [
  { id: "1", imageUrl: "/images/partners/mascot-skeptical.png", alt: "שותף בקרוב" },
  { id: "2", imageUrl: "/images/partners/mascot-shocked.png", alt: "שותף בקרוב" },
  { id: "3", imageUrl: "/images/partners/mascot-happy.png", alt: "שותף בקרוב" },
  { id: "4", imageUrl: "/images/partners/mascot-sad.png", alt: "שותף בקרוב" },
];

export function PartnersSection() {
  const [emblaRef] = useEmblaCarousel({
    direction: "rtl",
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="px-6">
        <h3 className="flex items-center gap-1 text-lg font-semibold tracking-tight text-ink">
          <span>השותפים של</span>
          <Image src="/images/triplace-logo-black.png" alt="Triplace" width={100} height={18} className="h-[30px] w-auto object-contain" />
          <span className="text-ink-secondary">(בקרוב)</span>
        </h3>
      </div>

      <div className="overflow-hidden px-6" ref={emblaRef}>
        <div className="flex">
          {PLACEHOLDER_PARTNERS.map((partner) => (
            <div key={partner.id} className="min-w-0 shrink-0 grow-0" style={{ flexBasis: "45%", marginInlineEnd: 12 }}>
              <div className="relative h-32 w-full overflow-hidden rounded-card bg-white shadow-soft">
                <Image
                  src={partner.imageUrl}
                  alt={partner.alt}
                  fill
                  sizes="45vw"
                  className="object-cover"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
