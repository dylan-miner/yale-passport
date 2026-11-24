import { Card } from "@/components/ui";

export default function DiscoverPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Discover
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Your city</h1>
      </div>
      <Card className="p-8 text-center">
        <p className="font-display text-lg italic text-ink-soft">
          Local clubs, events, and alumni land here.
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Location-aware discovery ships in a later milestone.
        </p>
      </Card>
    </div>
  );
}
