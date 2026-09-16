"use client";

import { useState } from "react";
import { Chip } from "./Chip";

interface ChipOption {
  value: string;
  label: string;
  emoji?: string;
  /** תמונה קטנה (עגולה) שתוצג לפני התווית, אם קיימת - עדיפות על emoji.
   *  אם הטעינה נכשלת (קובץ חסר) - נופלים חזרה ל-emoji אוטומטית, כדי
   *  שלא יוצג אייקון "שבור" ריק. */
  imageSrc?: string;
}

interface ChipGroupProps {
  options: ChipOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

/** קבוצת צ'יפים לבחירה מרובה, עוטפת את Chip ומנהלת את מערך הבחירות. */
export function ChipGroup({ options, selected, onChange }: ChipGroupProps) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Chip key={option.value} selected={selected.includes(option.value)} onClick={() => toggle(option.value)}>
          <ChipIcon option={option} />
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

function ChipIcon({ option }: { option: ChipOption }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (option.imageSrc && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={option.imageSrc}
        alt=""
        className="me-1.5 inline-block h-6 w-6 rounded-full object-cover align-middle"
        onError={() => setImageFailed(true)}
      />
    );
  }
  if (option.emoji) {
    return <span className="me-1">{option.emoji}</span>;
  }
  return null;
}
