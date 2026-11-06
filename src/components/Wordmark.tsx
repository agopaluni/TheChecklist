/* eslint-disable @next/next/no-img-element -- a 96px static PNG; next/image adds nothing here */
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
      <img src="/logo-mark.png" alt="" width={28} height={28} className="size-7 rounded-lg" />
      TheChecklist
    </span>
  );
}
