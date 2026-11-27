"use client";

import { useActionState } from "react";
import {
  sendMagicLink,
  signInDemo,
  signInWithPassword,
  type AuthFormState,
} from "@/app/actions/auth";
import { Button, Field, Input, Wordmark } from "@/components/ui";

const initial: AuthFormState = {};

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    initial,
  );
  const [linkState, linkAction, linkPending] = useActionState(
    sendMagicLink,
    initial,
  );
  const [demoState, demoAction, demoPending] = useActionState(
    () => signInDemo(),
    initial,
  );

  const error =
    passwordState.error ??
    linkState.error ??
    demoState.error ??
    (linkError ? "That sign-in link didn't work — request a new one." : null);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-9">
        <Wordmark />
        <h1 className="mt-8 font-display text-4xl font-semibold leading-tight text-ink">
          Welcome back.
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
          Sign in to pick up where you left off — alumni, events, and your
          concierge are waiting.
        </p>
      </div>

      <form action={passwordAction} className="flex flex-col gap-4">
        <Field label="Email">
          <Input name="email" type="email" required placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" required placeholder="••••••••" />
        </Field>
        <Button type="submit" disabled={passwordPending} className="mt-1">
          {passwordPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-ink-soft">
        <div className="h-px flex-1 bg-line-soft" />
        or continue with
        <div className="h-px flex-1 bg-line-soft" />
      </div>

      {linkState.sent ? (
        <p className="rounded-xl bg-affirm-soft px-4 py-3 text-sm text-affirm">
          Check your email — we sent you a magic sign-in link.
        </p>
      ) : (
        <form action={linkAction} className="flex flex-col gap-4">
          <Field label="Email" hint="We'll email you a one-time sign-in link.">
            <Input name="email" type="email" required placeholder="you@example.com" />
          </Field>
          <Button type="submit" variant="secondary" disabled={linkPending}>
            {linkPending ? "Sending…" : "Email me a magic link"}
          </Button>
        </form>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={demoAction} className="mt-6 border-t border-line-soft pt-6">
        <Button
          type="submit"
          variant="ghost"
          disabled={demoPending}
          className="w-full"
        >
          {demoPending ? "Signing in…" : "Continue with the demo account"}
        </Button>
      </form>
    </div>
  );
}
