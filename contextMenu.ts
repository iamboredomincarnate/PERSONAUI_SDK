import OBR from "@owlbear-rodeo/sdk";
import { tiles, type TileName } from "./src/assets/tileset";
import {
  ELEMENT_AFFINITIES,
  applyElementAffinitySettings,
  getElementAffinitySetting,
  readElementAffinities,
  syncTokenMemory,
} from "./src/elementAffinities";

const EXTENSION_ID = "iamboredomincarnate/persona-ui";
const AFFINITY_METADATA_KEY = "com.tutorial.initiative-tracker/affinity";
const EXTENSION_ICON = new URL(
  `${import.meta.env.BASE_URL}icon.svg`,
  window.location.href,
).toString();

export const affinities = [
  { label: "Friendly", value: "friendly" },
  { label: "Neutral", value: "neutral" },
  { label: "Hostile", value: "hostile" },
];

const tileNames = Object.keys(tiles) as TileName[];

export async function setupContextMenu(): Promise<void> {
  for (const affinity of affinities) {
    await OBR.contextMenu.create({
      id: `${EXTENSION_ID}/affinity-${affinity.value}`,
      icons: [
        {
          icon: EXTENSION_ICON,
          label: `Set affinity: ${affinity.label}`,
          filter: {
            some: [
              { key: "layer", value: "CHARACTER" },
              { key: "layer", value: "PROP" },
            ],
          },
        },
      ],
      async onClick(context) {
        await OBR.scene.items.updateItems(context.items, (items) => {
          for (const item of items) {
            item.metadata[AFFINITY_METADATA_KEY] = affinity.value;
          }
        });
      },
    });
  }

  for (const tileName of tileNames) {
    for (const resistance of ELEMENT_AFFINITIES) {
      await OBR.contextMenu.create({
        id: `${EXTENSION_ID}/resistance-${tileName}-${resistance.value}`,
        icons: [
          {
            icon: EXTENSION_ICON,
            label: `Resistance: ${tileName} — ${resistance.label}`,
            filter: {
              some: [
                { key: "layer", value: "CHARACTER" },
                { key: "layer", value: "PROP" },
              ],
            },
          },
        ],
        async onClick(context) {
          await OBR.scene.items.updateItems(context.items, (items) => {
            for (const item of items) {
              const settings = readElementAffinities(item);
              const current = getElementAffinitySetting(settings, tileName);

              settings[tileName] = {
                ...current,
                affinity: resistance.value,
              };

              applyElementAffinitySettings(item, settings);
            }
          });
          await syncTokenMemory(context.items.map((item) => item.id));
        },
      });
    }
  }
}
