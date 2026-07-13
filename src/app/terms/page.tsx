import { Screen } from "@/components/ui";

/** דף זמני — התוכן המשפטי המלא של התקנון יתווסף בשלב נפרד. */
export default function TermsPage() {
  return (
    <Screen withBottomNavSpacing={false}>
      <div className="mx-auto max-w-sm pt-6 text-center">
        <h1 className="text-2xl font-bold text-ink">תקנון</h1>
        <p className="mt-3 text-ink-secondary">
          התוכן המלא של התקנון יתווסף כאן בקרוב.
        </p>
      </div>
    </Screen>
  );
}
