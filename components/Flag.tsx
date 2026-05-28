import { flagCodeFor } from "@/lib/services/flags";

interface Props {
  team: string;
  /** Width in px — height scales automatically to maintain 3:2 ratio */
  size?: number;
  className?: string;
}

/**
 * Renders a country flag from flagcdn.com.
 * Uses <img> (not next/image) so no domain config is needed.
 * Works on Windows Chrome where OS-level flag emoji are unsupported.
 */
export default function Flag({ team, size = 20, className = "" }: Props) {
  const code = flagCodeFor(team);
  if (!code) return null;

  // flagcdn.com provides width-bucketed PNGs. Use 2× for retina.
  const w = size <= 20 ? 40 : size <= 32 ? 40 : 80;

  return (
    <img
      src={`https://flagcdn.com/w${w}/${code}.png`}
      srcSet={`https://flagcdn.com/w${w * 2}/${code}.png 2x`}
      width={size}
      alt={team}
      draggable={false}
      className={`inline-block flex-shrink-0 rounded-[1px] ${className}`}
      style={{ height: "auto" }}
    />
  );
}
