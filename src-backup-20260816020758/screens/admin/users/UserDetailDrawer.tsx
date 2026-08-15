"use client";

import { Drawer, DrawerSection, AdminButton } from "@/screens/admin/shared/Drawer";
import { Badge } from "@/screens/admin/shared/Primitives";
import type { RealUser } from "./types";

export function UserDetailDrawer({ user, onClose }: { user: RealUser | null; onClose: () => void }) {
  return (
    <Drawer
      open={!!user}
      onClose={onClose}
      title={user?.fullName || "ללא שם"}
      subtitle={user?.email}
      width={480}
      footer={
        <AdminButton variant="secondary" onClick={onClose}>
          סגור
        </AdminButton>
      }
    >
      {user && (
        <div className="flex flex-col">
          <DrawerSection title="פרטי חשבון">
            <Field label="סוג">
              <Badge tone={user.isAnonymous ? "neutral" : "accent"}>{user.isAnonymous ? "אורח" : "רשום"}</Badge>
            </Field>
            <Field label="נרשם ב-">{new Date(user.signupDate).toLocaleDateString("he-IL")}</Field>
            <Field label="התחברות אחרונה">{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString("he-IL") : "—"}</Field>
            <Field label="מיקום">{user.city ? `${user.city}, ${user.country ?? ""}` : "—"}</Field>
            <Field label="Onboarding הושלם">
              <Badge tone={user.onboardingCompleted ? "success" : "warning"}>{user.onboardingCompleted ? "כן" : "לא"}</Badge>
            </Field>
          </DrawerSection>

          <DrawerSection title="שימוש באפליקציה">
            <Field label="מסלולים שנבנו">{user.tripsBuilt}</Field>
            <Field label="מסלולים שנשמרו">{user.tripsSaved}</Field>
            <Field label="סוגי טיולים">{user.favoriteTripTypes.join(", ") || "—"}</Field>
          </DrawerSection>

          <DrawerSection title="העדפות">
            <Field label="תחומי עניין">
              <div className="flex flex-wrap gap-1.5">
                {user.interests.length > 0 ? user.interests.map((t) => <Badge key={t}>{t}</Badge>) : "—"}
              </div>
            </Field>
            <Field label="כשר">{user.kosher ? "כן" : "לא"}</Field>
            <Field label="נגישות">{user.accessibility ? "כן" : "לא"}</Field>
          </DrawerSection>
        </div>
      )}
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-[13px]" style={{ borderColor: "var(--admin-border)" }}>
      <span style={{ color: "var(--admin-ink-secondary)" }}>{label}</span>
      <span className="font-medium" style={{ color: "var(--admin-ink)" }}>
        {children}
      </span>
    </div>
  );
}
