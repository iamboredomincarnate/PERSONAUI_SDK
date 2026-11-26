import OBR from "@owlbear-rodeo/sdk";

const ID = "com.tutorial.initiative-tracker";
const AFFINITY_KEY = `${ID}/affinity`;

export const affinities = [
  { label: "Friendly", value: "friendly" },
  { label: "Neutral", value: "neutral" },
  { label: "Hostile", value: "hostile" },
];

export function setupContextMenu() {
  for (const affinity of affinities) {
    OBR.contextMenu.create({
      id: `${ID}/affinity-${affinity.value}`,
      icons: [
        {
          icon: "/add.svg",
          label: `Set affinity: ${affinity.label}`,
          filter: {
            every: [{ key: "layer", value: "CHARACTER" }],
          },
        },
      ],
      async onClick(context) {
        await OBR.scene.items.updateItems(context.items, (items) => {
          for (const item of items) {
            item.metadata[AFFINITY_KEY] = affinity.value;
          }
        });
      },
    });
  }
}