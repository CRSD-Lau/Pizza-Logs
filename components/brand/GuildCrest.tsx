import Image from "next/image";
import { cn } from "@/lib/utils";

export function GuildCrest({
  size = 44,
  alt = "",
  surface = "blend",
  className,
}: {
  size?: number;
  alt?: string;
  surface?: "blend" | "solid";
  className?: string;
}) {
  return (
    <Image
      src={surface === "solid" ? "/brand/icon-512.png" : "/brand/guild-crest-v1.png"}
      alt={alt}
      width={size}
      height={size}
      sizes={`${size}px`}
      loading="eager"
      className={cn("shrink-0 object-contain", surface === "solid" ? "rounded-full" : "mix-blend-lighten", className)}
    />
  );
}
