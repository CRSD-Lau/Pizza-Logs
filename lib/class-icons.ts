import { getPlayerClassMeta } from "./player-class";

export function getClassIconUrl(className: string | null | undefined): string | null {
  return getPlayerClassMeta(className).iconUrl;
}
