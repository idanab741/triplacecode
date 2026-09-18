import type { CandidatePlace, LatLng } from "./types";

const CELL_SIZE_KM = 1.2; // גודל תא ברשת - heuristic פשוט, לא אלגוריתם כבד

interface CategoryCandidates {
  category: string;
  candidates: CandidatePlace[];
}

interface Cell {
  latSum: number;
  lngSum: number;
  count: number;
  categoriesCovered: Set<string>;
}

/**
 * מזהה את האזור הגיאוגרפי (Cluster) הצפוף ביותר במקומות איכותיים, מתוך מועמדים
 * שנאספו על פני כמה קטגוריות במקביל. משתמש ברשת תאים גסה (heuristic מהיר),
 * לפי עקרון "Area Detection" מהמסמך - בונים את המסלול סביב אזור אחד,
 * במקום לזחול תחנה-אחר-תחנה בלי לראות את התמונה הכוללת.
 */
export function findBestCluster(categoriesCandidates: CategoryCandidates[], origin: LatLng): LatLng {
  const cells = new Map<string, Cell>();

  for (const { category, candidates } of categoriesCandidates) {
    for (const candidate of candidates) {
      const cellLat = Math.round(candidate.latitude / kmToDegLat(CELL_SIZE_KM));
      const cellLng = Math.round(candidate.longitude / kmToDegLng(CELL_SIZE_KM, candidate.latitude));
      const key = `${cellLat}:${cellLng}`;

      const existing = cells.get(key);
      if (existing) {
        existing.count += 1;
        existing.categoriesCovered.add(category);
        existing.latSum += candidate.latitude;
        existing.lngSum += candidate.longitude;
      } else {
        cells.set(key, {
          latSum: candidate.latitude,
          lngSum: candidate.longitude,
          count: 1,
          categoriesCovered: new Set([category]),
        });
      }
    }
  }

  if (cells.size === 0) return origin;

  // עדיפות ראשונה: תא שמכסה הכי הרבה קטגוריות שונות (כלומר, "יש שם הכל").
  // שוברי שוויון: התא הצפוף יותר במספר מועמדים כולל.
  let best: Cell | null = null;
  for (const cell of cells.values()) {
    if (
      !best ||
      cell.categoriesCovered.size > best.categoriesCovered.size ||
      (cell.categoriesCovered.size === best.categoriesCovered.size && cell.count > best.count)
    ) {
      best = cell;
    }
  }

  if (!best) return origin;
  return { lat: best.latSum / best.count, lng: best.lngSum / best.count };
}

function kmToDegLat(km: number): number {
  return km / 111;
}

function kmToDegLng(km: number, atLat: number): number {
  const kmPerDegree = 111 * Math.cos((atLat * Math.PI) / 180);
  return kmPerDegree === 0 ? km / 111 : km / kmPerDegree;
}