"use client";

import { useActionState, useState, useTransition } from "react";
import { signOut } from "@/app/actions/auth";
import {
  setConsent,
  updateProfile,
  type ProfileFormState,
} from "@/app/actions/profile";
import { CONSENT_COPY } from "@/lib/consents";
import { CONSENT_KEYS, type Consent, type ConsentKey, type Profile } from "@/lib/types";
import { Button, Card, Field, Input, Toggle } from "@/components/ui";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PassportCard({ profile }: { profile: Profile }) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-yale px-6 py-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Living Alumni Profile
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold">
              {profile.full_name} &rsquo;{String(profile.grad_year).slice(-2)}
            </h1>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/40 font-display text-lg font-semibold">
            {initials(profile.full_name)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-line px-6 py-4 text-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Home</p>
          <p className="mt-0.5 text-sm font-medium">{profile.home_city}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Now in</p>
          <p className="mt-0.5 text-sm font-medium">{profile.current_city}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Field</p>
          <p className="mt-0.5 text-sm font-medium">
            {profile.industry ?? "—"}
          </p>
        </div>
      </div>
    </Card>
  );
}

function ConsentEditor({ consents }: { consents: Consent[] }) {
  const map = new Map(consents.map((c) => [c.key, c.granted]));
  const [values, setValues] = useState<Record<ConsentKey, boolean>>(
    () =>
      Object.fromEntries(
        CONSENT_KEYS.map((k) => [k, map.get(k) ?? false]),
      ) as Record<ConsentKey, boolean>,
  );
  const [pending, startTransition] = useTransition();

  const update = (key: ConsentKey, granted: boolean) => {
    setValues((v) => ({ ...v, [key]: granted }));
    startTransition(async () => {
      const result = await setConsent(key, granted);
      if (result?.error) {
        setValues((v) => ({ ...v, [key]: !granted }));
      }
    });
  };

  return (
    <Card className="px-6 py-2">
      {CONSENT_KEYS.map((key) => {
        const copy = CONSENT_COPY[key];
        return (
          <div
            key={key}
            className="flex items-start justify-between gap-4 border-b border-line py-4 last:border-0"
          >
            <div>
              <p className="text-sm font-semibold text-ink">{copy.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                {copy.body}
              </p>
            </div>
            <Toggle
              checked={values[key]}
              disabled={pending}
              onChange={(next) => update(key, next)}
            />
          </div>
        );
      })}
    </Card>
  );
}

export function ProfileView({
  profile,
  consents,
}: {
  profile: Profile;
  consents: Consent[];
}) {
  const [state, formAction, pending] = useActionState(updateProfile, {
    error: undefined,
  } as ProfileFormState);

  const defaultList = (list: string[]) => (list ?? []).join(", ");

  return (
    <div className="flex flex-col gap-6">
      <PassportCard profile={profile} />

      <form action={formAction}>
        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Details</h2>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full name">
                <Input name="full_name" required defaultValue={profile.full_name} />
              </Field>
              <Field label="Grad year">
                <Input
                  name="grad_year"
                  type="number"
                  required
                  defaultValue={profile.grad_year}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Personal email">
                <Input
                  name="personal_email"
                  type="email"
                  defaultValue={profile.personal_email ?? ""}
                />
              </Field>
              <Field label="Phone">
                <Input name="phone_e164" defaultValue={profile.phone_e164 ?? ""} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Home city">
                <Input name="home_city" required defaultValue={profile.home_city} />
              </Field>
              <Field label="Current city">
                <Input
                  name="current_city"
                  required
                  defaultValue={profile.current_city}
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Industry">
                <Input name="industry" defaultValue={profile.industry ?? ""} />
              </Field>
              <Field label="Company">
                <Input name="company" defaultValue={profile.company ?? ""} />
              </Field>
              <Field label="Role">
                <Input name="role_title" defaultValue={profile.role_title ?? ""} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="LinkedIn">
                <Input name="linkedin_url" defaultValue={profile.linkedin_url ?? ""} />
              </Field>
              <Field label="Portfolio">
                <Input name="portfolio_url" defaultValue={profile.portfolio_url ?? ""} />
              </Field>
            </div>
            <Field label="Interests" hint="Comma-separated">
              <Input name="interests" defaultValue={defaultList(profile.interests)} />
            </Field>
            <Field label="I'm here for" hint="Comma-separated">
              <Input
                name="networking_goals"
                defaultValue={defaultList(profile.networking_goals)}
              />
            </Field>
            <Field label="Typical availability">
              <Input
                name="availability_text"
                defaultValue={profile.availability_text ?? ""}
              />
            </Field>
          </div>

          {state?.error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </p>
          )}
          {state?.saved && !state.error && (
            <p className="mt-4 rounded-xl bg-affirm-soft px-4 py-3 text-sm text-affirm">
              Saved — your passport is up to date.
            </p>
          )}

          <div className="mt-5">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </Card>
      </form>

      <section>
        <h2 className="mb-2 px-1 font-display text-lg font-semibold">Privacy &amp; consent</h2>
        <ConsentEditor consents={consents} />
      </section>

      <form action={signOut} className="pb-2">
        <Button type="submit" variant="ghost" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
