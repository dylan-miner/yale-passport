import type { ConsentKey } from "@/lib/types";

// Plain-language copy for the granular consent controls, shared by
// onboarding and the profile privacy section.
export const CONSENT_COPY: Record<ConsentKey, { title: string; body: string }> = {
  sms_opt_in: {
    title: "Text me",
    body: "Let the Passport concierge text me about matches, events, and check-ins. This is how the product works — no app-checking required.",
  },
  location_detection: {
    title: "Notice when I'm somewhere new",
    body: "Detect when I arrive in a new city so local events and alumni find me. Permanent moves are always confirmed with me first.",
  },
  directory_visibility: {
    title: "Appear in the alumni directory",
    body: "Let other opted-in alumni see my name, class year, city, and work. Contact details are never listed.",
  },
  introductions: {
    title: "Offer me introductions",
    body: "Suggest 1:1 intros to alumni who share my goals. My contact info is shared only after we both say yes.",
  },
  yaa_sharing: {
    title: "Keep Yale's records current",
    body: "Share my personal email and city with the Yale Alumni Association so they can reach me after my .edu address expires.",
  },
};
