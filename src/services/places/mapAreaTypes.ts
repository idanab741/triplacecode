/** אזור (עיר / כפר / אזור) שנבחר בחיפוש של מפת place's - המפה עוברת אליו ומסמנת את הגבולות שלו. */
export interface MapArea {
  name: string;
  subtitle: string | null;
  center: { lat: number; lng: number };
  /** [[south, west], [north, east]] */
  bounds: [[number, number], [number, number]];
  /** גבול העיר (GeoJSON Polygon/MultiPolygon) - null כשאין (אז רק מתמקדים בתחום). */
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
}

export interface AreaSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}
