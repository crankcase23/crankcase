import Image from "next/image";

/**
 * The supplied Crankcase Garage logo, unaltered. public/brand/ holds the
 * provided artwork with only its empty transparent margins trimmed (the pixels
 * of the mark itself are identical to the supplied file). Never redraw it.
 */
export default function BrandLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/brand/crankcase-garage-logo.png"
      alt="Crankcase Garage"
      width={1975}
      height={361}
      priority
      className={className}
    />
  );
}
