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
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
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
      </div>
    </div>
  );
}
