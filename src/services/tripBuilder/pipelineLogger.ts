/**
 * תיקון פער אמיתי (Audit מול MASTER SPEC סעיפים 188-193 - Debug Logging):
 * לוגים קיימים היו ad-hoc (console.error/console.warn עם מבנה שונה בכל
 * מקום) - לא מערכת עקבית. זו **לא** מערכת logging מלאה (queue/aggregation/
 * dashboard) - זה לא נדרש כאן ואין תשתית קיימת לחבר אליה. זה מינימום
 * שמאפשר לעקוב אחרי build ספציפי דרך ה-pipeline: מזהה build אחיד, שלב,
 * תוצאה - כדי שאפשר יהיה לחפש לפי buildId בלוגי Vercel ולראות את כל
 * ה-pipeline של build ספציפי אחד ברצף, במקום לנחש איזה שורות שייכות
 * לאיזו בקשה. בלי PII - sessionId בלבד (לא email/שם/מיקום מדויק).
 */

export type PipelineStage =
  | "intent"
  | "destination"
  | "lodging"
  | "blueprint"
  | "candidate_pool"
  | "ranking"
  | "validation"
  | "repair"
  | "quality_check"
  | "finalize";

interface LogContext {
  sessionId: string;
  tripType?: string;
  stage: PipelineStage;
}

function buildLogPrefix(ctx: LogContext): string {
  return `[build:${ctx.sessionId.slice(0, 8)}][${ctx.tripType ?? "?"}][${ctx.stage}]`;
}

export function logPipelineInfo(ctx: LogContext, message: string, extra?: Record<string, unknown>): void {
  console.log(`${buildLogPrefix(ctx)} ${message}`, extra ?? {});
}

export function logPipelineWarning(ctx: LogContext, message: string, extra?: Record<string, unknown>): void {
  console.warn(`${buildLogPrefix(ctx)} ${message}`, extra ?? {});
}

export function logPipelineError(ctx: LogContext, message: string, extra?: Record<string, unknown>): void {
  console.error(`${buildLogPrefix(ctx)} ${message}`, extra ?? {});
}
