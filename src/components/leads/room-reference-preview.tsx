type RoomReferencePreviewProps = {
  roomName: string;
};

export function RoomReferencePreview({ roomName }: RoomReferencePreviewProps) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-control border border-border bg-background">
      <svg
        viewBox="0 0 320 200"
        aria-hidden="true"
        focusable="false"
        className="block aspect-[8/5] w-full"
      >
        <rect width="320" height="200" className="fill-background" />

        <path d="M0 142H320V200H0Z" className="fill-secondary" />

        <rect
          x="202"
          y="24"
          width="78"
          height="95"
          rx="5"
          className="fill-card stroke-border"
          strokeWidth="3"
        />

        <path d="M241 26V117M204 71H278" className="stroke-border" strokeWidth="3" />

        <rect x="37" y="91" width="137" height="58" rx="15" className="fill-accent" />

        <rect x="27" y="119" width="157" height="38" rx="12" className="fill-taupe" />

        <rect x="45" y="102" width="48" height="34" rx="9" className="fill-accent-soft" />

        <rect x="106" y="102" width="48" height="34" rx="9" className="fill-secondary" />

        <path
          d="M44 157V168M168 157V168"
          className="stroke-foreground"
          strokeWidth="5"
          strokeLinecap="round"
        />

        <ellipse cx="223" cy="163" rx="43" ry="10" className="fill-background" />

        <rect x="217" y="145" width="12" height="29" rx="3" className="fill-accent" />

        <ellipse
          cx="223"
          cy="144"
          rx="35"
          ry="8"
          className="fill-card stroke-border"
          strokeWidth="2"
        />

        <rect x="290" y="113" width="15" height="35" rx="4" className="fill-accent" />

        <path d="M297 115C274 103 279 79 295 93C294 72 317 78 302 104" className="fill-taupe" />
      </svg>

      <figcaption className="border-t border-border p-3">
        <p className="text-sm font-semibold text-foreground">{roomName}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Illustrative placeholder · no uploaded image
        </p>
      </figcaption>
    </figure>
  );
}
