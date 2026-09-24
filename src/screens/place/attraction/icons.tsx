/** אייקוני קו אחידים לעמוד האטרקציה (22px, עובי 1.8, צבע הטקסט). */
const P = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const PinIcon = () => (
  <svg {...P}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
export const ClockIcon = () => (
  <svg {...P}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const WalletIcon = () => (
  <svg {...P}>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18M16.5 14.5h1" />
  </svg>
);
export const WheelchairIcon = () => (
  <svg {...P}>
    <circle cx="11" cy="4.5" r="1.6" />
    <path d="M11 7.5v6h5l2.5 5M11 10.5h4.5" />
    <path d="M8.2 11.2a5 5 0 1 0 6.9 6.3" />
  </svg>
);
export const TagIcon = () => (
  <svg {...P}>
    <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0Z" />
    <circle cx="8" cy="8" r="1.4" />
  </svg>
);
export const CarIcon = () => (
  <svg {...P}>
    <path d="M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5" />
    <path d="M3.5 16.5h17M5 12h14" />
    <circle cx="7.5" cy="16.5" r="1.8" />
    <circle cx="16.5" cy="16.5" r="1.8" />
  </svg>
);
export const PlaneIcon = () => (
  <svg {...P}>
    <path d="m21 15-8-4.5V5a1.5 1.5 0 0 0-3 0v5.5L2 15v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-4.5l8 2.5Z" />
  </svg>
);
export const ChevronIcon = ({ open = false }: { open?: boolean }) => (
  <svg {...P} width={18} height={18} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const ChevronStartIcon = () => (
  <svg {...P} width={18} height={18}>
    <path d="m14 6-6 6 6 6" />
  </svg>
);
