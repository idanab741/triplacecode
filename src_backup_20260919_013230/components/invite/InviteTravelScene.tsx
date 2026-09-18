/**
 * הסצנה הוויזואלית של כרטיסיית "הזמן חברים".
 *
 * לא תמונת HERO מועתקת - איור SVG חדש שממשיך את אותה שפה חזותית:
 * דמות ה-Triplace (גוף כחול בגרדיאנט, קפוצ'ון עם הלוגו העגול, ציצת שיער),
 * מזוודה, מטוס עם נתיב טיסה, ורמז עדין ליעד חדש (נקודת מפה + סימון מסלול).
 * הדמות מנופפת לשלום ומזמינה את הצופה להצטרף - "בוא איתי", לא "הורד את
 * האפליקציה". פלטת הצבעים וה-gradient זהים לטוקנים של האפליקציה
 * (--color-primary-start/--color-primary-end).
 */
export function InviteTravelScene() {
  return (
    <svg
      viewBox="0 0 400 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-auto w-full"
      role="img"
      aria-label="דמות Triplace מנופפת לשלום ליד מזוודה, עם מטוס בשמיים"
    >
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eaf3ff" />
          <stop offset="100%" stopColor="#f9fbff" />
        </linearGradient>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6e0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff6e0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary-start)" />
          <stop offset="100%" stopColor="var(--color-primary-end)" />
        </linearGradient>
        <linearGradient id="caseGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary-end)" />
          <stop offset="100%" stopColor="#144fad" />
        </linearGradient>
        <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eef5ff" />
          <stop offset="100%" stopColor="#e3edfb" />
        </linearGradient>
      </defs>

      {/* רקע שמיים רך */}
      <rect x="0" y="0" width="400" height="240" fill="url(#skyGrad)" />
      <circle cx="70" cy="60" r="90" fill="url(#sunGlow)" />

      {/* קרקע עדינה - רמז לרציף/מדרגות יעד, בלי לגלוש לסטוק */}
      <path d="M0 205 C 90 190, 310 190, 400 205 L 400 240 L 0 240 Z" fill="url(#groundGrad)" />

      {/* עננים עדינים */}
      <g opacity="0.75">
        <ellipse cx="60" cy="40" rx="26" ry="10" fill="#ffffff" />
        <ellipse cx="80" cy="34" rx="18" ry="9" fill="#ffffff" />
        <ellipse cx="330" cy="30" rx="22" ry="9" fill="#ffffff" />
        <ellipse cx="350" cy="36" rx="15" ry="7" fill="#ffffff" />
      </g>

      {/* מטוס + נתיב טיסה - רמז לטיסה/יציאה לדרך */}
      <g transform="translate(255,42) rotate(18)">
        <path
          d="M0 6 L34 6 L44 2 L48 4 L40 8 L48 12 L44 14 L34 10 L0 10 Z"
          fill="var(--color-primary-end)"
        />
        <path d="M14 6 L6 -6 L12 -6 L22 6 Z" fill="var(--color-primary-end)" />
        <path d="M14 10 L6 20 L12 20 L22 10 Z" fill="var(--color-primary-end)" />
      </g>
      <path
        d="M244 58 C 210 50, 178 46, 150 44"
        stroke="var(--color-primary-end)"
        strokeOpacity="0.35"
        strokeWidth="2.5"
        strokeDasharray="1 8"
        strokeLinecap="round"
        fill="none"
      />

      {/* נתיב מקווקו + סימון יעד - "בואו לגלות את הטיול הבא שלכם יחד" */}
      <path
        d="M228 178 C 258 168, 285 172, 305 160"
        stroke="var(--color-primary-start)"
        strokeOpacity="0.4"
        strokeWidth="2.5"
        strokeDasharray="1 7"
        strokeLinecap="round"
        fill="none"
      />
      <g transform="translate(305,145)">
        <path
          d="M0 0 C 8 0 14 6 14 14 C 14 24 0 38 0 38 C 0 38 -14 24 -14 14 C -14 6 -8 0 0 0 Z"
          fill="var(--color-primary-start)"
          opacity="0.9"
        />
        <circle cx="0" cy="14" r="5" fill="#ffffff" />
      </g>

      {/* צל רך למרגלות הדמות */}
      <ellipse cx="150" cy="214" rx="58" ry="9" fill="#1a1a2e" opacity="0.08" />

      {/* מזוודה */}
      <g transform="translate(196,150)">
        <rect x="0" y="10" width="15" height="6" rx="3" fill="#8a8fa3" />
        <rect x="-2" y="14" width="52" height="52" rx="10" fill="url(#caseGrad)" />
        <rect x="-2" y="14" width="52" height="52" rx="10" fill="#ffffff" opacity="0.06" />
        <rect x="6" y="30" width="34" height="4" rx="2" fill="#ffffff" opacity="0.35" />
        <circle cx="14" cy="52" r="7" fill="#ffffff" />
        <path d="M9 52 L19 52 M14 47 L14 57" stroke="var(--color-primary-end)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="33" cy="52" r="4.5" fill="#ffffff" />
        <path d="M28 46 Q33 42 38 46 L38 50 Q33 47 28 50 Z" fill="#ff9f4a" />
        <circle cx="5" cy="66" r="4" fill="#1a1a2e" opacity="0.55" />
        <circle cx="43" cy="66" r="4" fill="#1a1a2e" opacity="0.55" />
      </g>

      {/* דמות Triplace - גוף/ראש אחד בגרדיאנט כחול, מנופפת לשלום */}
      <g transform="translate(148,88)">
        {/* יד מונפת לשלום */}
        <path
          d="M40 40 C 55 30, 62 14, 58 2"
          stroke="url(#bodyGrad)"
          strokeWidth="15"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="58" cy="2" r="9" fill="url(#bodyGrad)" />

        {/* גוף/קפוצ'ון */}
        <path
          d="M46 62 C 46 30, 24 8, 0 8 C -24 8, -46 30, -46 62 C -46 92, -22 108, 0 108 C 22 108, 46 92, 46 62 Z"
          fill="url(#bodyGrad)"
        />

        {/* לוגו עגול על החזה */}
        <circle cx="0" cy="70" r="13" fill="#ffffff" opacity="0.95" />
        <circle cx="0" cy="70" r="4.5" fill="url(#bodyGrad)" />

        {/* ציצת שיער */}
        <path d="M-6 -14 C -10 -28, 6 -30, 4 -14 C 10 -22, 16 -10, 6 -6 C 0 -10, -4 -8, -6 -14 Z" fill="url(#bodyGrad)" />

        {/* יד שנייה אוחזת בידית המזוודה */}
        <path d="M-38 46 C -44 58, -44 68, -40 78" stroke="url(#bodyGrad)" strokeWidth="15" strokeLinecap="round" fill="none" />

        {/* עיניים */}
        <ellipse cx="-15" cy="18" rx="11" ry="13" fill="#ffffff" />
        <ellipse cx="15" cy="18" rx="11" ry="13" fill="#ffffff" />
        <circle cx="-13" cy="20" r="5.5" fill="#1a1a2e" />
        <circle cx="17" cy="20" r="5.5" fill="#1a1a2e" />
        <circle cx="-11" cy="17" r="1.8" fill="#ffffff" />
        <circle cx="19" cy="17" r="1.8" fill="#ffffff" />

        {/* חיוך */}
        <path d="M-9 34 Q0 42 9 34" stroke="#1a1a2e" strokeWidth="2.6" strokeLinecap="round" fill="none" />

        {/* רגליים + נעליים */}
        <rect x="-14" y="104" width="10" height="20" rx="4" fill="url(#bodyGrad)" />
        <rect x="4" y="104" width="10" height="20" rx="4" fill="url(#bodyGrad)" />
        <ellipse cx="-9" cy="126" rx="10" ry="6" fill="#ffffff" />
        <ellipse cx="9" cy="126" rx="10" ry="6" fill="#ffffff" />
      </g>
    </svg>
  );
}
