"use client";

import { useState } from "react";
import { getPlayerClassMeta, normalizePlayerClass } from "@/lib/player-class";
import type { PlayerProfile } from "@/lib/player-profile";
import { PlayerAvatar } from "./PlayerAvatar";

export function PlayerProfileIdentity({ profile, latestSpec }: {
  profile: Omit<PlayerProfile, "milestones">;
  latestSpec: string | null;
}) {
  const [correction, setCorrection] = useState<{ initial: string | null; value: string | null } | null>(null);
  const meta = getPlayerClassMeta(correction?.initial === profile.className ? correction.value : profile.className);
  return (
    <div className="flex items-center gap-4">
      <PlayerAvatar
        name={profile.name} realmName={profile.realmName} characterClass={meta.className}
        raceName={profile.raceName} guildName={profile.guildName} color={meta.color} size="lg"
        onClassResolved={value => {
          const className = normalizePlayerClass(value);
          if (value === null || className) setCorrection({ initial: profile.className, value: className });
        }}
      />
      <div className="min-w-0">
        <h1 className="heading-cinzel break-words text-2xl font-bold" style={{ color: meta.textColor }}>{profile.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-secondary">{meta.label}</span>
          {latestSpec && <span className="text-sm text-gold">{latestSpec}</span>}
          {profile.raceName && <span className="text-sm text-text-dim">{profile.raceName}</span>}
          {profile.level && <span className="text-xs text-text-dim">Level {profile.level}</span>}
          <span className="text-xs text-text-dim">{profile.realmName}</span>
          {profile.guildName && <span className="text-xs text-gold">{profile.guildName}</span>}
          {profile.rankName && <span className="text-xs text-text-secondary">{profile.rankName}</span>}
        </div>
      </div>
    </div>
  );
}
