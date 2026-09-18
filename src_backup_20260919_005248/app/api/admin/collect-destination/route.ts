import { NextResponse } from "next/server";
import { collectDestination } from "@/services/destinations/collectionService";

/** נקודת קצה לאדמין בלבד, אוספת תמונת נוף מייצגת ליעד ברמת עיר. */
export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name: string | undefined = body?.name;
  const country: string | undefined = body?.country;
  const searchQuery: string | undefined = body?.searchQuery;
  const description: string | undefined = body?.description;

  if (!name || !country || !searchQuery) {
    return NextResponse.json(
      { error: "יש לספק name, country ו-searchQuery" },
      { status: 400 }
    );
  }

  try {
    const result = await collectDestination({ name, country, searchQuery, description });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
