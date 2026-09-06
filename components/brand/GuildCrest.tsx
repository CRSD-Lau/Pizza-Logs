import Image from "next/image";
import { cn } from "@/lib/utils";

export function GuildCrest({
  size = 44,
  alt = "",
  className,
}: {
  size?: number;
  alt?: string;
  className?: string;
}) {
  return (
    <Image
      src="/brand/guild-crest-v1.png"
      alt={alt}
      width={size}
      height={size}
      sizes={`${size}px`}
      loading="eager"
      className={cn("shrink-0 object-contain mix-blend-lighten", className)}
    />
  );
}
