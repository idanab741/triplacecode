export interface DailyWeather {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
}

/** תחזית שבועית דרך Open-Meteo - שירות חינמי, בלי מפתח API. */
export async function getWeeklyForecast(
  latitude: number,
  longitude: number
): Promise<DailyWeather[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=7`;

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) return [];

  const data = await response.json();
  const dates: string[] = data.daily?.time ?? [];

  return dates.map((date, index) => ({
    date,
    maxTemp: Math.round(data.daily.temperature_2m_max[index]),
    minTemp: Math.round(data.daily.temperature_2m_min[index]),
    weatherCode: data.daily.weathercode[index],
  }));
}
