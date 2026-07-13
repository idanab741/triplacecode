/** תקציר קצר על יעד, מתוך ויקיפדיה העברית - שירות חינמי, בלי מפתח. */
export async function getWikipediaSummary(title: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://he.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    );
    if (!response.ok) return null;

    const data = await response.json();
    const extract: string | undefined = data.extract;
    if (!extract) return null;

    if (extract.length <= 220) return extract;
    const truncated = extract.slice(0, 220);
    const lastSpace = truncated.lastIndexOf(" ");
    return `${truncated.slice(0, lastSpace)}...`;
  } catch {
    return null;
  }
}
