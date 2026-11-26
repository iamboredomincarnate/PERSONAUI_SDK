import OBR from "@owlbear-rodeo/sdk";
import { tiles, type TileName } from "./src/assets/tileset";
import {
  ELEMENT_AFFINITIES,
  ELEMENT_AFFINITY_METADATA_KEY,
  getElementAffinitySetting,
  readElementAffinities,
} from "./src/elementAffinities";

const ID = "com.tutorial.initiative-tracker";
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

export function setupContextMenu() {
  for (const affinity of affinities) {
    OBR.contextMenu.create({
      id: `${ID}/affinity-${affinity.value}`,
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
            item.metadata[`${ID}/affinity`] = affinity.value;
          }
        });
      },
    });
  }

  for (const tileName of tileNames) {
    for (const resistance of ELEMENT_AFFINITIES) {
      OBR.contextMenu.create({
        id: `${ID}/resistance-${tileName}-${resistance.value}`,
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

              item.metadata[ELEMENT_AFFINITY_METADATA_KEY] = settings;
            }
          });
        },
      });
    }
  }
}