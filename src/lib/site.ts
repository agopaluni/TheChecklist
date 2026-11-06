// The app's real address, and old addresses that should forward to it. Guests on an old
// address bring their device token along so they stay the same person (see
// `adopt_guest_token` in supabase/migrations).
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thechecklist.me";

export const LEGACY_HOSTS = (
  process.env.NEXT_PUBLIC_LEGACY_HOSTS ??
  "thechecklist-phi.vercel.app,thechecklist-agopalunis-projects.vercel.app"
)
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

export const HANDOFF_PARAM = "handoff";

// Runs in <head> before anything else on an old address: forward to the same page on the
// real address, carrying this browser's guest token in the #fragment (never sent to any
// server; the new site removes it from the address bar straight away).
export const forwardScript = `(function(){try{
var legacy=${JSON.stringify(LEGACY_HOSTS)};
if(legacy.indexOf(location.hostname)<0)return;
var t=localStorage.getItem("tc:device-token");
location.replace(${JSON.stringify(SITE_URL)}+location.pathname+location.search+(t?"#${HANDOFF_PARAM}="+encodeURIComponent(t):""));
}catch(e){}})();`;
