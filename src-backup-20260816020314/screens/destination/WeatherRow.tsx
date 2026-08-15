import type { DailyWeather } from "@/services/weather/weatherService";
import { describeWeatherCode, formatHebrewWeekday } from "@/utils/weatherCodes";

interface WeatherRowProps {
  forecast: DailyWeather[];
}

export function WeatherRow({ forecast }: WeatherRowProps) {
  if (forecast.length === 0) return null;

  return (
    <div className="px-6">
      <h3 className="mb-3 text-lg font-semibold text-ink">מזג אוויר לשבוע הקרוב</h3>
      <div className="-mx-6 overflow-x-auto ps-6 pb-1" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-3">
          {forecast.map((day) => {
            const { label, emoji } = describeWeatherCode(day.weatherCode);
            return (
              <div
                key={day.date}
                className="flex shrink-0 flex-col items-center gap-1 rounded-card bg-bg-secondary px-4 py-3"
              >
                <span className="text-xs font-semibold text-ink">{formatHebrewWeekday(day.date)}</span>
                <span className="text-2xl">{emoji}</span>
                <span className="text-xs text-ink-secondary">{label}</span>
                <span className="text-xs font-medium text-ink">
                  {day.maxTemp}° / {day.minTemp}°
                </span>
              </div>
            );
          })}
          {/* spacer סוף הרשימה - padding-inline-end על קונטיינר גלילה לא אמין
              בין דפדפנים (נחתך במקרים מסוימים), אז מוסיפים רווח אמיתי כפריט
              אחרון במקום, כדי שיהיה זהה לרווח בהתחלה גם אחרי גלילה מלאה. */}
          <div className="w-3 shrink-0" aria-hidden />
        </div>
      </div>
    </div>
  );
}
