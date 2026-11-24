"use client";

import { useActionState } from "react";
import {
  sendMagicLink,
  signInDemo,
  signInWithPassword,
  type AuthFormState,
} from "@/app/actions/auth";
import { Button, Card, Field, Input, Wordmark } from "@/components/ui";

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
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <Wordmark />
        <p className="font-display text-2xl italic text-ink">
          Your Yale network, wherever you land.
        </p>
        <p className="text-sm text-ink-soft">
          Warm introductions to local alumni, delivered by text. For recent
          graduates who just moved.
        </p>
      </div>

      <Card className="p-6">
        <form action={passwordAction} className="flex flex-col gap-4">
          <Field label="Email">
            <Input name="email" type="email" required placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" required placeholder="••••••••" />
          </Field>
          <Button type="submit" disabled={passwordPending}>
            {passwordPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
          <div className="h-px flex-1 bg-line" />
          or
          <div className="h-px flex-1 bg-line" />
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
      </Card>

      <form action={demoAction} className="mt-4">
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
