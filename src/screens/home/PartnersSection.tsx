"use client";

import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";

interface Partner {
  id: string;
  name: string;
}

const PLACEHOLDER_PARTNERS: Partner[] = [
  { id: "1", name: "בקרוב" },
  { id: "2", name: "בקרוב" },
  { id: "3", name: "בקרוב" },
  { id: "4", name: "בקרוב" },
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
        </h3>
      </div>

      <div className="overflow-hidden px-6" ref={emblaRef}>
        <div className="flex">
          {PLACEHOLDER_PARTNERS.map((partner) => (
            <div key={partner.id} className="min-w-0 shrink-0 grow-0" style={{ flexBasis: "45%", marginInlineEnd: 12 }}>
              <div className="flex h-32 w-full flex-col items-center justify-center overflow-hidden rounded-card bg-white text-center shadow-soft">
                <p className="text-sm font-semibold text-ink-secondary">{partner.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
