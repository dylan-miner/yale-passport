import { Card } from "@/components/ui";

export default function ConnectPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Connect
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Introductions</h1>
      </div>
      <Card className="p-8 text-center">
        <p className="font-display text-lg italic text-ink-soft">
          Warm, double-opt-in intros appear here.
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          When the concierge finds a good match, you&rsquo;ll approve it here or
          by text.
        </p>
      </Card>
    </div>
  );
}
