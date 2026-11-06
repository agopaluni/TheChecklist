type P = { className?: string };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export const CheckIcon = ({ className = "size-4" }: P) => (
  <svg {...base} strokeWidth={3} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const PlusIcon = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const MoreIcon = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <circle cx="5" cy="12" r="1.3" fill="currentColor" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    <circle cx="19" cy="12" r="1.3" fill="currentColor" />
  </svg>
);
export const ShareIcon = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
  </svg>
);
export const BackIcon = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const CloseIcon = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const ListIcon = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
);
export const GoogleIcon = ({ className = "size-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      fill="#4285F4"
      d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h5.9a5.05 5.05 0 01-2.2 3.3v2.75h3.55c2.08-1.92 3.25-4.74 3.25-8.08z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.05-3.72 1.05-2.86 0-5.29-1.93-6.15-4.53H2.17v2.84A11 11 0 0012 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.85 14.1a6.6 6.6 0 010-4.2V7.06H2.17a11 11 0 000 9.88l3.68-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15A10.97 10.97 0 0012 1 11 11 0 002.17 7.06l3.68 2.84C6.71 7.31 9.14 5.38 12 5.38z"
    />
  </svg>
);
