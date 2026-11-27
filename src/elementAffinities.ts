import OBR, {
  isImage,
  type Descendant,
  type Item,
  type TextContent,
} from "@owlbear-rodeo/sdk";
import { tiles, type TileName } from "./assets/tileset";

export const ELEMENT_AFFINITY_METADATA_KEY =
  "iamboredomincarnate/persona-ui/element-affinities";
export const ELEMENT_AFFINITY_MEMORY_ID_METADATA_KEY =
  "iamboredomincarnate/persona-ui/memory-id";
export const ELEMENT_AFFINITY_MEMORY_METADATA_KEY =
  "iamboredomincarnate/persona-ui/memory";
const ELEMENT_AFFINITY_BASE_NAME_METADATA_KEY =
  `${ELEMENT_AFFINITY_METADATA_KEY}/base-name`;
const TOKEN_LEVEL_METADATA_KEY =
  "iamboredomincarnate/persona-ui/token-level";
const TOKEN_UNKNOWN_LEVEL_METADATA_KEY =
  "iamboredomincarnate/persona-ui/token-level-unknown";
const TOKEN_PLUGIN_ENABLED_METADATA_KEY =
  "iamboredomincarnate/persona-ui/plugin-enabled";
const TOKEN_IMAGE_LABEL_METADATA_KEY =
  "iamboredomincarnate/persona-ui/original-image-label";

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

export type TokenDisplaySettings = {
  level: number;
  unknownLevel: boolean;
  usePlugin: boolean;
};

export type ElementAffinityMemory = {
  affinities: ElementAffinityMap;
  baseName: string;
  level: number;
  unknownLevel: boolean;
  usePlugin: boolean;
};

const TILE_NAMES = Object.keys(tiles) as TileName[];

type StoredImageLabel = Pick<TextContent, "plainText" | "richText">;

export function isTokenItem(item: Item): boolean {
  return item.layer === "CHARACTER" || item.layer === "PROP";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTextDescendant(value: unknown): value is Descendant {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.text === "string") {
    return ["bold", "italic", "underline"].every(
      (key) => value[key] === undefined || typeof value[key] === "boolean",
    );
  }

  const elementTypes = [
    "bulleted-list",
    "numbered-list",
    "heading-one",
    "heading-two",
    "list-item",
    "paragraph",
  ];

  return (
    typeof value.type === "string" &&
    elementTypes.includes(value.type) &&
    Array.isArray(value.children) &&
    value.children.every(isTextDescendant)
  );
}

function isStoredImageLabel(value: unknown): value is StoredImageLabel {
  return (
    isRecord(value) &&
    typeof value.plainText === "string" &&
    Array.isArray(value.richText) &&
    value.richText.every(isTextDescendant)
  );
}

function cloneTextDescendant(value: Descendant): Descendant {
  if ("text" in value) {
    return { ...value };
  }

  return {
    ...value,
    children: value.children.map(cloneTextDescendant),
  };
}

function updateNativeName(
  item: Item,
  baseName: string,
  usePlugin: boolean,
): void {
  item.name = usePlugin ? "" : baseName;

  if (!isImage(item) || item.textItemType !== "LABEL") {
    return;
  }

  const storedLabel = item.metadata[TOKEN_IMAGE_LABEL_METADATA_KEY];

  if (storedLabel !== undefined && !isStoredImageLabel(storedLabel)) {
    throw new Error(`Invalid image label metadata on token "${item.id}".`);
  }

  if (!usePlugin) {
    if (storedLabel) {
      // A label typed while the plugin was on is newer than the saved copy.
      if (item.text.plainText === "") {
        item.text.plainText = storedLabel.plainText;
        item.text.richText = storedLabel.richText.map(cloneTextDescendant);
      }

      delete item.metadata[TOKEN_IMAGE_LABEL_METADATA_KEY];
    }

    return;
  }

  if (item.text.plainText !== "") {
    item.metadata[TOKEN_IMAGE_LABEL_METADATA_KEY] = {
      plainText: item.text.plainText,
      richText: item.text.richText.map(cloneTextDescendant),
    };
    item.text.plainText = "";
    item.text.richText = [];
  }
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

export function readTokenDisplaySettings(item: Item): TokenDisplaySettings {
  const level = item.metadata[TOKEN_LEVEL_METADATA_KEY];
  const unknownLevel = item.metadata[TOKEN_UNKNOWN_LEVEL_METADATA_KEY];
  const usePlugin = item.metadata[TOKEN_PLUGIN_ENABLED_METADATA_KEY];

  if (
    level !== undefined &&
    (typeof level !== "number" ||
      !Number.isSafeInteger(level) ||
      level < 0)
  ) {
    throw new Error(`Invalid level metadata on token "${item.id}".`);
  }

  if (unknownLevel !== undefined && typeof unknownLevel !== "boolean") {
    throw new Error(`Invalid unknown-level metadata on token "${item.id}".`);
  }

  if (usePlugin !== undefined && typeof usePlugin !== "boolean") {
    throw new Error(`Invalid plugin-enabled metadata on token "${item.id}".`);
  }

  return {
    level: level ?? 0,
    unknownLevel: unknownLevel ?? false,
    usePlugin: usePlugin ?? false,
  };
}

export function getElementAffinityBaseName(item: Item): string {
  const storedBaseName = item.metadata[ELEMENT_AFFINITY_BASE_NAME_METADATA_KEY];

  if (storedBaseName === undefined) {
    return item.name;
  }

  if (typeof storedBaseName !== "string") {
    throw new Error(
      `Invalid element affinity name metadata on token "${item.id}".`,
    );
  }

  return storedBaseName;
}

export function getDisplayName(item: Item): string {
  if (isImage(item) && item.textItemType === "LABEL") {
    const stored = item.metadata[TOKEN_IMAGE_LABEL_METADATA_KEY];
    const label =
      item.text.plainText ||
      (isStoredImageLabel(stored) ? stored.plainText : "");

    if (label) {
      return label;
    }
  }

  return getElementAffinityBaseName(item);
}

function normalizeMemoryIdentityPart(value: string): string {
  return value.trim().toLowerCase();
}

export function getDerivedTokenMemoryIdentity(item: Item): string {
  if (isImage(item)) {
    const url = item.image.url.split(/[?#]/, 1)[0];
    return `image:${normalizeMemoryIdentityPart(url)}`;
  }

  const name = normalizeMemoryIdentityPart(getElementAffinityBaseName(item));
  return name ? `name:${name}` : `item:${item.id}`;
}

export function getTokenMemoryIdentity(item: Item): string {
  const stored = item.metadata[ELEMENT_AFFINITY_MEMORY_ID_METADATA_KEY];

  if (typeof stored === "string" && stored.length > 0) {
    return stored;
  }

  return getDerivedTokenMemoryIdentity(item);
}

function cloneElementAffinityMap(
  settings: ElementAffinityMap,
): ElementAffinityMap {
  const result: ElementAffinityMap = {};

  for (const name of TILE_NAMES) {
    const setting = settings[name];

    if (setting) {
      result[name] = {
        affinity: setting.affinity,
        visible: setting.visible,
      };
    }
  }

  return result;
}

export function readTokenMemory(item: Item): ElementAffinityMemory | undefined {
  const stored = item.metadata[ELEMENT_AFFINITY_MEMORY_METADATA_KEY];

  if (stored === undefined) {
    return undefined;
  }

  if (!isRecord(stored)) {
    throw new Error(`Invalid memory metadata on token "${item.id}".`);
  }

  if (
    !isRecord(stored.affinities) ||
    typeof stored.baseName !== "string" ||
    typeof stored.level !== "number" ||
    !Number.isSafeInteger(stored.level) ||
    stored.level < 0 ||
    typeof stored.unknownLevel !== "boolean" ||
    typeof stored.usePlugin !== "boolean"
  ) {
    throw new Error(`Invalid memory metadata on token "${item.id}".`);
  }

  const affinities: ElementAffinityMap = {};

  for (const name of TILE_NAMES) {
    const setting = stored.affinities[name];

    if (setting === undefined) {
      continue;
    }

    if (
      !isRecord(setting) ||
      !isElementAffinity(setting.affinity) ||
      typeof setting.visible !== "boolean"
    ) {
      throw new Error(`Invalid memory affinity data on token "${item.id}".`);
    }

    affinities[name] = {
      affinity: setting.affinity,
      visible: setting.visible,
    };
  }

  return {
    affinities,
    baseName: stored.baseName,
    level: stored.level,
    unknownLevel: stored.unknownLevel,
    usePlugin: stored.usePlugin,
  };
}

export function createTokenMemory(item: Item): ElementAffinityMemory {
  const display = readTokenDisplaySettings(item);

  return {
    affinities: cloneElementAffinityMap(readElementAffinities(item)),
    baseName: getElementAffinityBaseName(item),
    level: display.level,
    unknownLevel: display.unknownLevel,
    usePlugin: display.usePlugin,
  };
}

export function writeTokenMemory(item: Item, memory: ElementAffinityMemory): void {
  item.metadata[ELEMENT_AFFINITY_BASE_NAME_METADATA_KEY] = memory.baseName;
  applyElementAffinitySettings(
    item,
    cloneElementAffinityMap(memory.affinities),
    memory.usePlugin,
  );
  item.metadata[TOKEN_LEVEL_METADATA_KEY] = memory.level;
  item.metadata[TOKEN_UNKNOWN_LEVEL_METADATA_KEY] = memory.unknownLevel;
  item.metadata[ELEMENT_AFFINITY_MEMORY_ID_METADATA_KEY] =
    getTokenMemoryIdentity(item);
  item.metadata[ELEMENT_AFFINITY_MEMORY_METADATA_KEY] = {
    affinities: cloneElementAffinityMap(memory.affinities),
    baseName: memory.baseName,
    level: memory.level,
    unknownLevel: memory.unknownLevel,
    usePlugin: memory.usePlugin,
  };
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
  const storedBaseName = item.metadata[ELEMENT_AFFINITY_BASE_NAME_METADATA_KEY];
  const usePlugin = readTokenDisplaySettings(item).usePlugin;

  if (storedBaseName !== undefined && typeof storedBaseName !== "string") {
    throw new Error(
      `Invalid element affinity name metadata on token "${item.id}".`,
    );
  }

  if (!usePlugin) {
    return storedBaseName === undefined || item.name === storedBaseName;
  }

  if (item.name !== "") {
    return false;
  }

  return (
    !isImage(item) ||
    item.textItemType !== "LABEL" ||
    item.text.plainText === ""
  );
}

export function applyElementAffinitySettings(
  item: Item,
  settings: ElementAffinityMap,
  usePlugin = readTokenDisplaySettings(item).usePlugin,
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
    (item.name === "" ||
      item.name === storedBaseName ||
      item.name === formatElementAffinityName(storedBaseName, previousSettings))
      ? storedBaseName
      : item.name;

  item.metadata[ELEMENT_AFFINITY_BASE_NAME_METADATA_KEY] = baseName;
  item.metadata[ELEMENT_AFFINITY_METADATA_KEY] = settings;
  item.metadata[TOKEN_PLUGIN_ENABLED_METADATA_KEY] = usePlugin;
  updateNativeName(item, baseName, usePlugin);

  const display = readTokenDisplaySettings(item);
  item.metadata[ELEMENT_AFFINITY_MEMORY_ID_METADATA_KEY] =
    getTokenMemoryIdentity(item);
  item.metadata[ELEMENT_AFFINITY_MEMORY_METADATA_KEY] = {
    affinities: cloneElementAffinityMap(settings),
    baseName,
    level: display.level,
    unknownLevel: display.unknownLevel,
    usePlugin,
  };
}

export async function saveElementAffinities(
  itemId: string,
  settings: ElementAffinityMap,
  displaySettings: TokenDisplaySettings,
): Promise<void> {
  if (
    !Number.isSafeInteger(displaySettings.level) ||
    displaySettings.level < 0
  ) {
    throw new Error("Token level must be a non-negative integer.");
  }

  const [item] = await OBR.scene.items.getItems([itemId]);

  if (!item || !isTokenItem(item)) {
    throw new Error(`Token "${itemId}" is no longer available.`);
  }

  await OBR.scene.items.updateItems([item], (drafts) => {
    drafts[0].metadata[TOKEN_LEVEL_METADATA_KEY] = displaySettings.level;
    drafts[0].metadata[TOKEN_UNKNOWN_LEVEL_METADATA_KEY] =
      displaySettings.unknownLevel;
    applyElementAffinitySettings(
      drafts[0],
      settings,
      displaySettings.usePlugin,
    );
  });

  await syncTokenMemory([itemId]);
}

export async function saveTokenPluginSetting(
  itemId: string,
  usePlugin: boolean,
): Promise<void> {
  const [item] = await OBR.scene.items.getItems([itemId]);

  if (!item || !isTokenItem(item)) {
    throw new Error(`Token "${itemId}" is no longer available.`);
  }

  await OBR.scene.items.updateItems([item], (drafts) => {
    const token = drafts[0];
    applyElementAffinitySettings(token, readElementAffinities(token), usePlugin);
  });

  await syncTokenMemory([itemId]);
}

function memoryMatches(left: Item, right: Item): boolean {
  const storedLeft = left.metadata[ELEMENT_AFFINITY_MEMORY_ID_METADATA_KEY];
  const storedRight = right.metadata[ELEMENT_AFFINITY_MEMORY_ID_METADATA_KEY];
  const derivedLeft = getDerivedTokenMemoryIdentity(left);
  const derivedRight = getDerivedTokenMemoryIdentity(right);

  if (derivedLeft === derivedRight) {
    return true;
  }

  if (
    typeof storedLeft === "string" &&
    typeof storedRight === "string" &&
    storedLeft === storedRight
  ) {
    return true;
  }

  return (
    (typeof storedLeft === "string" && storedLeft === derivedRight) ||
    (typeof storedRight === "string" && storedRight === derivedLeft)
  );
}

export async function syncTokenMemory(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) {
    return;
  }

  const sources = await OBR.scene.items.getItems(itemIds);

  if (sources.length === 0) {
    return;
  }

  const allItems = await OBR.scene.items.getItems();

  for (const source of sources) {
    if (!isTokenItem(source)) {
      continue;
    }

    const matches = allItems.filter(
      (item) => isTokenItem(item) && memoryMatches(source, item),
    );

    if (matches.length === 0) {
      continue;
    }

    let winner = source;

    for (const candidate of matches) {
      if (candidate.lastModified > winner.lastModified) {
        winner = candidate;
      }
    }

    const memory =
      readTokenMemory(winner) ??
      createTokenMemory(winner);

    await OBR.scene.items.updateItems(matches, (drafts) => {
      for (const draft of drafts) {
        const current = readTokenMemory(draft);

        if (
          current &&
          JSON.stringify(current) === JSON.stringify(memory)
        ) {
          continue;
        }

        writeTokenMemory(draft, memory);
      }
    });
  }
}