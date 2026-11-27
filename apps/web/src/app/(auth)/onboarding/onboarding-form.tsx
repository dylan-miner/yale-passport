"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { completeOnboarding, type ProfileFormState } from "@/app/actions/profile";
import { CONSENT_COPY } from "@/lib/consents";
import { CONSENT_KEYS, type ConsentKey } from "@/lib/types";
import { Button, Card, Field, Input, Toggle, Wordmark } from "@/components/ui";

const INTEREST_OPTIONS = [
  "startups", "product", "climate tech", "finance", "consulting",
  "biotech", "medicine", "law", "media", "AI/ML", "education",
  "nonprofit", "design", "policy", "venture capital",
];

const GOAL_OPTIONS = [
  "peer connections", "career advice", "mentorship",
  "hiring", "meet alumni", "job hunting",
];

function ChipSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.has(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "border-yale bg-yale text-white"
                : "border-line bg-white text-ink-soft hover:border-yale/40"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function ConsentRow({
  consentKey,
  granted,
  onChange,
}: {
  consentKey: ConsentKey;
  granted: boolean;
  onChange: (next: boolean) => void;
}) {
  const copy = CONSENT_COPY[consentKey];
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-4 last:border-0">
      <input type="checkbox" name={`consent_${consentKey}`} checked={granted} readOnly className="hidden" />
      <div>
        <p className="text-sm font-semibold text-ink">{copy.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{copy.body}</p>
      </div>
      <Toggle checked={granted} onChange={onChange} />
    </div>
  );
}

const STEPS = ["About you", "Work & interests", "Privacy"];

export function OnboardingForm({ email }: { email: string }) {
  const [step, setStep] = useState(0);
  const [state, formAction, pending] = useActionState(completeOnboarding, {
    error: undefined,
  } as ProfileFormState);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [goals, setGoals] = useState<Set<string>>(new Set());
  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({
    sms_opt_in: true,
    location_detection: true,
    directory_visibility: true,
    introductions: true,
    yaa_sharing: false,
  });

  const toggleIn = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <Wordmark />
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Step {step + 1} of {STEPS.length}
        </span>
      </div>

      <div className="mb-8 flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col gap-1.5">
            <div
              className={`h-1 rounded-full ${i <= step ? "bg-yale" : "bg-line-soft"}`}
            />
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                i <= step ? "text-yale" : "text-ink-soft/60"
              }`}
            >
              {s}
            </span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="relative mb-7 h-36 overflow-hidden rounded-2xl">
          <Image
            src="/photos/yale-quad.jpg"
            alt="Yale's Old Campus"
            fill
            className="object-cover"
            sizes="(max-width: 512px) 100vw, 512px"
          />
          <div className="absolute inset-0 bg-yale-night/45" />
          <p className="absolute bottom-3 left-4 font-display text-lg italic text-white">
            From Old Campus to everywhere.
          </p>
        </div>
      )}

      <h1 className="font-display text-3xl font-semibold text-ink">
        {step === 0 && "Welcome to Passport"}
        {step === 1 && "Make it useful for you"}
        {step === 2 && "You're in control"}
      </h1>
      <p className="mt-1.5 mb-6 text-sm text-ink-soft">
        {step === 0 && "A few essentials — everything is editable later."}
        {step === 1 && "This powers relevant matches. Skip anything you'd rather add later."}
        {step === 2 && "Choose exactly what Passport can see and do."}
      </p>

      <form action={formAction}>
        <input type="hidden" name="interests" value={[...interests].join(",")} />
        <input type="hidden" name="networking_goals" value={[...goals].join(",")} />

        {/* Step 1 — essentials */}
        <Card className={`p-6 ${step !== 0 ? "hidden" : ""}`}>
          <div className="flex flex-col gap-4">
            <Field label="Full name">
              <Input name="full_name" required placeholder="Alex Morgan" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Grad year">
                <Input name="grad_year" type="number" required placeholder="2024" min={1900} max={2100} />
              </Field>
              <Field label="Phone" hint="For the SMS concierge">
                <Input name="phone_e164" type="tel" placeholder="+1 555 123 4567" />
              </Field>
            </div>
            <Field label="Personal email" hint="Not your .edu address — this is how we reach you after it expires.">
              <Input name="personal_email" type="email" defaultValue={email} placeholder="you@example.com" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Home city">
                <Input name="home_city" required placeholder="New Haven" />
              </Field>
              <Field label="Current city">
                <Input name="current_city" required placeholder="Boston" />
              </Field>
            </div>
          </div>
        </Card>

        {/* Step 2 — work & interests */}
        <Card className={`p-6 ${step !== 1 ? "hidden" : ""}`}>
          <div className="flex flex-col gap-4">
            <Field label="Industry">
              <Input name="industry" placeholder="Technology" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Company">
                <Input name="company" placeholder="Beacon Labs" />
              </Field>
              <Field label="Role">
                <Input name="role_title" placeholder="Product Manager" />
              </Field>
            </div>
            <Field label="Interests">
              <ChipSelect
                options={INTEREST_OPTIONS}
                selected={interests}
                onToggle={(v) => setInterests(toggleIn(interests, v))}
              />
            </Field>
            <Field label="I'm here for">
              <ChipSelect
                options={GOAL_OPTIONS}
                selected={goals}
                onToggle={(v) => setGoals(toggleIn(goals, v))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="LinkedIn">
                <Input name="linkedin_url" placeholder="https://linkedin.com/in/…" />
              </Field>
              <Field label="Typical availability">
                <Input name="availability_text" placeholder="Weekday evenings" />
              </Field>
            </div>
          </div>
        </Card>

        {/* Step 3 — consent */}
        <Card className={`px-6 py-2 ${step !== 2 ? "hidden" : ""}`}>
          {CONSENT_KEYS.map((key) => (
            <ConsentRow
              key={key}
              consentKey={key}
              granted={consents[key]}
              onChange={(next) => setConsents({ ...consents, [key]: next })}
            />
          ))}
        </Card>

        {state?.error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? "Setting up…" : "Finish setup"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
