/** אימוג'י קטגוריה לתחנה - ל-Preview ב-Trip Card ולרשימות. עובד גם עם 5 הקטגוריות הראשיות (places.category)
 *  וגם עם מזהי הקטגוריות המפורטות הקיימים (coffee_carts_cafes, nature_trails וכו'). */
export function placeCategoryEmoji(category: string | null | undefined): string {
  const c = (category ?? "").toLowerCase();
  if (c.includes("coffee") || c.includes("cafe")) return "☕";
  if (c.includes("beach") || c.includes("pool")) return "🏖️";
  if (c.includes("view")) return "🌅";
  if (c.includes("night") || c.includes("bar")) return "🌙";
  if (c.includes("hotel")) return "🏨";
  if (c.includes("rest") || c.includes("culinary") || c.includes("dining") || c.includes("wine")) return "🍴";
  if (c.includes("nature") || c.includes("park") || c.includes("trail") || c.includes("garden")) return "🌳";
  if (c.includes("attraction") || c.includes("culture") || c.includes("amusement")) return "🎡";
  return "📍";
}
