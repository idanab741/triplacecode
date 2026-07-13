import { Button, Card } from "@/components/ui";

interface SignupPromptProps {
  onClose: () => void;
}

/** מוצג לאורח שמנסה ללייק/לשמור - מזמין אותו להירשם. */
export function SignupPrompt({ onClose }: SignupPromptProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={onClose}>
      <Card
        className="w-full max-w-sm text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-bold text-ink">רוצים לשמור את זה?</p>
        <p className="mt-1 text-sm text-ink-secondary">
          הירשמו כדי לשמור מקומות ולקבל המלצות מותאמות אישית
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button href="/auth" fullWidth>
            הרשמה / התחברות
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            אולי אחר כך
          </Button>
        </div>
      </Card>
    </div>
  );
}
