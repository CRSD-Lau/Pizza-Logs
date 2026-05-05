"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type PlayerAvatarSize = "xs" | "sm" | "lg";

type PlayerAvatarProps = {
  name: string;
  realmName?: string | null;
  characterClass?: string | null;
  raceName?: string | null;
  guildName?: string | null;
  color: string;
  fallbackIconUrl?: string | null;
  size?: PlayerAvatarSize;
  className?: string;
};

const SIZE_CLASSES: Record<PlayerAvatarSize, string> = {
  xs: "w-9 h-9 text-xs",
  sm: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
};

export function PlayerAvatar({
  name,
  realmName,
  characterClass,
  raceName,
  guildName,
  color,
  fallbackIconUrl,
  size = "sm",
  className,
}: PlayerAvatarProps) {
  const [iconFailed, setIconFailed] = useState(false);
  const initials = getInitials(name);
  const imageUrl = !iconFailed && fallbackIconUrl ? fallbackIconUrl : null;
  const state = imageUrl ? "fallback-icon" : "initials";

  return (
    <div
      aria-label={`${name} avatar`}
      className={cn(
        "rounded-sm flex-shrink-0 flex items-center justify-center overflow-hidden font-bold",
        SIZE_CLASSES[size],
        className,
      )}
      data-pizza-avatar="character"
      data-pizza-avatar-state={state}
      data-character-name={name}
      data-character-realm={realmName ?? "Lordaeron"}
      data-character-class={characterClass ?? ""}
      data-character-race={raceName ?? ""}
      data-character-guild={guildName ?? ""}
      data-initials={initials}
      data-fallback-icon-url={fallbackIconUrl ?? ""}
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Class icon URLs are external and not known at build time.
        <img
          data-pizza-avatar-image="true"
          src={imageUrl}
          alt={`${name} avatar`}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setIconFailed(true)}
        />
      ) : (
        <span data-pizza-avatar-initials="true">{initials}</span>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  return name.trim().substring(0, 2).toUpperCase() || "??";
}
