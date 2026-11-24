import { Card } from "@/components/ui";

export default function ConciergePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Concierge
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Yale Passport</h1>
      </div>
      <Card className="p-8 text-center">
        <p className="font-display text-lg italic text-ink-soft">
          Your SMS concierge is on its way.
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Ask for introductions, events, or tell it when you move — same thread
          as your texts.
        </p>
      </Card>
    </div>
  );
}
