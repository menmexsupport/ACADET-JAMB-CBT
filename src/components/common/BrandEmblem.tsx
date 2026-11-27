interface BrandEmblemProps {
  sizeClass?: string;
}

export default function BrandEmblem({ sizeClass = 'h-9 w-9' }: BrandEmblemProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`${sizeClass} shrink-0`}
      role="img"
      aria-label="Pre-JAMB Academy CBT Emblem"
    >
      <circle cx="32" cy="32" r="30" fill="#FFFFFF" stroke="#0B5E2E" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="24" fill="#F2F4F7" stroke="#094D25" strokeWidth="1.5" />
      <path
        d="M17 24c5-2 10-2 15 1 5-3 10-3 15-1v16c-5-2-10-1-15 2-5-3-10-4-15-2V24z"
        fill="#FFFFFF"
        stroke="#0B5E2E"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1="32" y1="25" x2="32" y2="42" stroke="#0B5E2E" strokeWidth="1.8" />
      <path d="M32 13l2.2 4.5-2.2 2.5-2.2-2.5L32 13z" fill="#16A34A" />
      <rect x="16" y="45" width="32" height="9" rx="2" fill="#0B5E2E" />
      <text
        x="32"
        y="51.5"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="6.5"
        fontWeight="700"
        fontFamily="Arial, sans-serif"
        letterSpacing="0.8"
      >
        UTME
      </text>
    </svg>
  );
}
