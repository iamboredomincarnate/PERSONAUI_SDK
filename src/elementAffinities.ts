import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { tiles, type TileName } from "./assets/tileset";

export const ELEMENT_AFFINITY_METADATA_KEY =
  "iamboredomincarnate/persona-ui/element-affinities";

export const ELEMENT_AFFINITIES = [
  { value: "neutral", label: "Neutral", display: "-" },
  { value: "weak", label: "Weak", display: "Wk" },
  { value: "strong", label: "Strong", display: "Str" },
  { value: "null", label: "Null", display: "Nl" },
  { value: "drain", label: "Drain", display: "Dr" },
] as const;

export type ElementAffinity = (typeof ELEMENT_AFFINITIES)[number]["value"];

export type ElementAffinitySetting = {
  affinity: ElementAffinity;
  visible: boolean;
};

export type ElementAffinityMap = Partial<
  Record<TileName, ElementAffinitySetting>
>;

const TILE_NAMES = Object.keys(tiles) as TileName[];

export function isTokenItem(item: Item): boolean {
  return item.layer === "CHARACTER" || item.layer === "PROP";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isElementAffinity(value: unknown): value is ElementAffinity {
  return ELEMENT_AFFINITIES.some((option) => option.value === value);
}

export function readElementAffinities(
  item: Item,
): ElementAffinityMap {
  const stored = item.metadata[ELEMENT_AFFINITY_METADATA_KEY];

  if (stored === undefined) {
    return {};
  }

  if (!isRecord(stored)) {
    throw new Error(`Invalid element affinity metadata on token "${item.id}".`);
  }

  const result: ElementAffinityMap = {};

  for (const name of TILE_NAMES) {
    const setting = stored[name];

    if (setting === undefined) {
      continue;
    }

    if (
      !isRecord(setting) ||
      !isElementAffinity(setting.affinity) ||
      typeof setting.visible !== "boolean"
    ) {
      throw new Error(
        `Invalid ${name} affinity metadata on token "${item.id}".`,
      );
    }

    result[name] = {
      affinity: setting.affinity,
      visible: setting.visible,
    };
  }

  return result;
}

export function getElementAffinitySetting(
  settings: ElementAffinityMap,
  name: TileName,
): ElementAffinitySetting {
  return settings[name] ?? { affinity: "neutral", visible: false };
}

export async function saveElementAffinities(
  itemId: string,
  settings: ElementAffinityMap,
): Promise<void> {
  const [item] = await OBR.scene.items.getItems([itemId]);

  if (!item || !isTokenItem(item)) {
    throw new Error(`Token "${itemId}" is no longer available.`);
  }

  await OBR.scene.items.updateItems([item], (drafts) => {
    drafts[0].metadata[ELEMENT_AFFINITY_METADATA_KEY] = settings;
  });
}
