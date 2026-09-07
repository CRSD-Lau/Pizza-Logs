/** Process-local resource bounds; no client-controlled IP header can bypass them. */
export function createUploadAdmission(
  { concurrent = 4, starts = 12, windowMs = 60_000 } = {},
  now: () => number = Date.now,
) {
  let active = 0;
  let startedAt: number[] = [];
  return {
    acquire(): { release: () => void } | null {
      const time = now();
      startedAt = startedAt.filter(start => start > time - windowMs);
      if (active >= concurrent || startedAt.length >= starts) return null;
      active += 1;
      startedAt.push(time);
      let released = false;
      return {
        release() {
          if (released) return;
          released = true;
          active -= 1;
        },
      };
    },
  };
}

export const uploadAdmission = createUploadAdmission();
export const uploadStatusAdmission = createUploadAdmission({ concurrent: 8, starts: 600 });
