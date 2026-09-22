"use client";

import { SOCIAL_LABELS, SOCIAL_PLATFORMS, socialProfileUrl, type SocialPlatform } from "@/services/social/socialLinks";
import { SocialIcon } from "./SocialIcons";

interface ProfileSocialLinksProps {
  instagram: string | null;
  tiktok: string | null;
  isSelf: boolean;
  onEdit: (platform: SocialPlatform) => void;
}

/** פילים של Instagram / TikTok בפרופיל. בפרופיל שלי: כשאין - פיל מקווקו "הוסף אינסטגרם +" (כמו באינסטגרם),
 *  כשיש - פיל עם ה-handle שלחיצה עליו פותחת עריכה/הסרה. אצל אחרים: רק מה שהוגדר, כקישור החוצה. */
export function ProfileSocialLinks({ instagram, tiktok, isSelf, onEdit }: ProfileSocialLinksProps) {
  const handles: Record<SocialPlatform, string | null> = { instagram, tiktok };
  const visible = SOCIAL_PLATFORMS.filter((p) => isSelf || handles[p]);
  if (visible.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {visible.map((platform) => {
        const handle = handles[platform];

        if (!handle) {
          return (
            <button
              key={platform}
              type="button"
              onClick={() => onEdit(platform)}
              className="flex items-center gap-1.5 rounded-pill border border-dashed border-ink-secondary/40 px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-secondary"
            >
              <SocialIcon platform={platform} />
              {SOCIAL_LABELS[platform].add}
              <span className="text-[15px] leading-none">+</span>
            </button>
          );
        }

        const pill = (
          <>
            <SocialIcon platform={platform} />
            <span dir="ltr">@{handle}</span>
          </>
        );
        const className = "flex items-center gap-1.5 rounded-pill bg-bg-secondary px-3.5 py-1.5 text-[12.5px] font-semibold text-ink";

        return isSelf ? (
          <button key={platform} type="button" onClick={() => onEdit(platform)} className={className} aria-label={`עריכת ${SOCIAL_LABELS[platform].name}`}>
            {pill}
          </button>
        ) : (
          <a key={platform} href={socialProfileUrl(platform, handle)} target="_blank" rel="noopener noreferrer" className={className}>
            {pill}
          </a>
        );
      })}
    </div>
  );
}
