import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { tiles, type TileName } from "./assets/tileset";

export const ELEMENT_AFFINITY_METADATA_KEY =
  "iamboredomincarnate/persona-ui/element-affinities";
const ELEMENT_AFFINITY_BASE_NAME_METADATA_KEY =
  `${ELEMENT_AFFINITY_METADATA_KEY}/base-name`;

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

function formatElementAffinityName(
  baseName: string,
  settings: ElementAffinityMap,
): string {
  const summary: string[] = [];

  for (const name of TILE_NAMES) {
    const setting = getElementAffinitySetting(settings, name);

    if (!setting.visible) {
      continue;
    }

    const affinity = ELEMENT_AFFINITIES.find(
      (option) => option.value === setting.affinity,
    );

    if (!affinity) {
      throw new Error(`Unknown affinity "${setting.affinity}" for ${name}.`);
    }

    summary.push(`${name} ${affinity.display}`);
  }

  if (summary.length === 0) {
    return baseName;
  }

  return baseName
    ? `${baseName} · ${summary.join(" · ")}`
    : summary.join(" · ");
}

export function isElementAffinityNameCurrent(item: Item): boolean {
  const settings = readElementAffinities(item);
  const storedBaseName = item.metadata[ELEMENT_AFFINITY_BASE_NAME_METADATA_KEY];

  if (storedBaseName === undefined) {
    return !TILE_NAMES.some(
      (name) => getElementAffinitySetting(settings, name).visible,
    );
  }

  if (typeof storedBaseName !== "string") {
    throw new Error(
      `Invalid element affinity name metadata on token "${item.id}".`,
    );
  }

  return item.name === formatElementAffinityName(storedBaseName, settings);
}

export function applyElementAffinitySettings(
  item: Item,
  settings: ElementAffinityMap,
): void {
  const storedBaseName = item.metadata[ELEMENT_AFFINITY_BASE_NAME_METADATA_KEY];

  if (storedBaseName !== undefined && typeof storedBaseName !== "string") {
    throw new Error(
      `Invalid element affinity name metadata on token "${item.id}".`,
    );
  }

  const previousSettings = readElementAffinities(item);
  const baseName =
    typeof storedBaseName === "string" &&
    item.name === formatElementAffinityName(storedBaseName, previousSettings)
      ? storedBaseName
      : item.name;

  item.metadata[ELEMENT_AFFINITY_BASE_NAME_METADATA_KEY] = baseName;
  item.metadata[ELEMENT_AFFINITY_METADATA_KEY] = settings;
  item.name = formatElementAffinityName(baseName, settings);
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
    applyElementAffinitySettings(drafts[0], settings);
  });
}
