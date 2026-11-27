import OBR, {
  buildImage,
  buildPath,
  buildText,
  Command,
  type Item,
  type PathCommand,
} from "@owlbear-rodeo/sdk";
import { tiles, type TileName } from "./assets/tileset";
import {
  ELEMENT_AFFINITIES,
  getDisplayName,
  getElementAffinitySetting,
  isTokenItem,
  readElementAffinities,
  readTokenDisplaySettings,
} from "./elementAffinities";

const OVERLAY_KEY = "iamboredomincarnate/persona-ui/overlay";
const TILE_NAMES = Object.keys(tiles) as TileName[];

// Pixel size of each PNG in public/tiles (see exportTiles.ts).
const TILE_IMAGE_SIZE = 64;

// Layout, in the design's pixels. The whole card scales from the token's width.
const DESIGN = {
  width: 525,
  headerHeight: 72,
  radius: 12,
  sidePadding: 2.5,
  iconTop: 80, // header + 8px gap
  iconSize: 40,
  labelHeight: 40,
  bottomPadding: 8,
  bar: { inset: 20, top: 50, height: 10, radius: 5 },
  title: { size: 25, top: 23.5, gap: 16, margin: 20 },
  labelSize: 20,
};
const CARD_HEIGHT =
  DESIGN.iconTop +
  DESIGN.iconSize +
  DESIGN.labelHeight +
  DESIGN.bottomPadding;
const CARD_WIDTH_RATIO = 1; // card width / token width
const BOTTOM_INSET_RATIO = 0; // raise the card by this fraction of token height

const COLORS = {
  body: "#02263f",
  header: "#4fa4fb",
  bar: "#7fdcff",
  name: "#12163f",
  level: "#04294a",
  label: "#b6e6ff",
};
const TITLE_FONT = "Arial, Helvetica, sans-serif";
const LABEL_FONT = "Open Sans, Arial, sans-serif";

type Overlay = { signature: string; itemIds: string[] };

function tileUrl(name: TileName): string {
  return new URL(
    `${import.meta.env.BASE_URL}tiles/${encodeURIComponent(name)}.png`,
    window.location.origin,
  ).toString();
}

function roundedRect(
  width: number,
  height: number,
  topRadius: number,
  bottomRadius = topRadius,
): PathCommand[] {
  const t = topRadius;
  const b = bottomRadius;
  const w = Math.SQRT1_2; // conic weight for a circular corner

  return [
    [Command.MOVE, t, 0],
    [Command.LINE, width - t, 0],
    [Command.CONIC, width, 0, width, t, w],
    [Command.LINE, width, height - b],
    [Command.CONIC, width, height, width - b, height, w],
    [Command.LINE, b, height],
    [Command.CONIC, 0, height, 0, height - b, w],
    [Command.LINE, 0, t],
    [Command.CONIC, 0, 0, t, 0, w],
    [Command.CLOSE],
  ];
}

const measureContext = document.createElement("canvas").getContext("2d");

// Width of bold title text in design pixels, used to center name and level.
function titleWidth(value: string): number {
  if (!measureContext) {
    throw new Error("Canvas is not available to measure text.");
  }

  measureContext.font = `700 ${DESIGN.title.size}px ${TITLE_FONT}`;
  return measureContext.measureText(value).width;
}

async function buildOverlay(
  token: Item,
  isGameMaster: boolean,
  sceneDpi: number,
): Promise<Item[]> {
  const settings = readElementAffinities(token);
  const display = readTokenDisplaySettings(token);
  const bounds = await OBR.scene.items.getItemBounds([token.id]);

  const width = bounds.width * CARD_WIDTH_RATIO;
  const k = width / DESIGN.width; // scene units per design pixel
  const left = bounds.center.x - width / 2;
  const top =
    bounds.max.y - bounds.height * BOTTOM_INSET_RATIO - CARD_HEIGHT * k;
  const baseZIndex = Date.now();

  // Settings shared by every piece. Items attached to a token follow it
  // natively, and the camera transforms them along with the rest of the scene.
  const common = <
    B extends ReturnType<
      typeof buildPath | typeof buildText | typeof buildImage
    >,
  >(
    builder: B,
    zOffset: number,
  ): B => {
    builder
      .layer("ATTACHMENT")
      .attachedTo(token.id)
      // We rebuild on resize ourselves, and the card should stay upright.
      .disableAttachmentBehavior(["ROTATION", "SCALE", "LOCKED", "COPY"])
      .locked(true)
      .disableHit(true)
      .disableAutoZIndex(true)
      .zIndex(baseZIndex + zOffset)
      .visible(token.visible)
      .metadata({ [OVERLAY_KEY]: token.id });
    return builder;
  };

  // x, y, sizes and radii below are all in design pixels.
  const panel = (
    x: number,
    y: number,
    boxWidth: number,
    boxHeight: number,
    color: string,
    zOffset: number,
    topRadius: number,
    bottomRadius = topRadius,
  ): Item =>
    common(buildPath(), zOffset)
      .position({ x: left + x * k, y: top + y * k })
      .commands(
        roundedRect(
          boxWidth * k,
          boxHeight * k,
          topRadius * k,
          bottomRadius * k,
        ),
      )
      .fillColor(color)
      .fillOpacity(1)
      .strokeOpacity(0)
      .strokeWidth(0)
      .build();

  const text = (
    value: string,
    x: number,
    y: number,
    boxWidth: number,
    boxHeight: number,
    fontSize: number,
    fontFamily: string,
    color: string,
    align: "LEFT" | "CENTER",
  ): Item =>
    common(buildText(), 3)
      .textType("PLAIN")
      .plainText(value)
      .position({ x: left + x * k, y: top + y * k })
      .width(boxWidth * k)
      .height(boxHeight * k)
      .padding(0)
      .fontFamily(fontFamily)
      .fontSize(fontSize * k)
      .fontWeight(700)
      .lineHeight(1)
      .textAlign(align)
      .textAlignVertical("MIDDLE")
      .fillColor(color)
      .fillOpacity(1)
      .strokeOpacity(0)
      .strokeWidth(0)
      .build();

  const name = getDisplayName(token) || "Unnamed";
  const level =
    display.level === 0
      ? ""
      : `Level: ${display.unknownLevel ? "???" : display.level}`;
  const nameWidth = titleWidth(name);
  const levelWidth = level ? titleWidth(level) : 0;
  const gap = level ? DESIGN.title.gap : 0;
  const available = DESIGN.width - DESIGN.title.margin * 2;
  // Shrink both together if a long name wouldn't fit.
  const fit = Math.min(1, available / (nameWidth + gap + levelWidth));
  const titleLeft =
    (DESIGN.width - (nameWidth + gap + levelWidth) * fit) / 2;
  const titleSize = DESIGN.title.size * fit;
  // Spare room in each text box so it never wraps.
  const slack = 12;

  const items: Item[] = [
    panel(0, 0, DESIGN.width, CARD_HEIGHT, COLORS.body, 0, DESIGN.radius),
    panel(
      0,
      0,
      DESIGN.width,
      DESIGN.headerHeight,
      COLORS.header,
      1,
      DESIGN.radius,
      0,
    ),
    panel(
      DESIGN.bar.inset,
      DESIGN.bar.top,
      DESIGN.width - DESIGN.bar.inset * 2,
      DESIGN.bar.height,
      COLORS.bar,
      2,
      DESIGN.bar.radius,
    ),
    text(
      name,
      titleLeft,
      DESIGN.title.top,
      nameWidth * fit + slack,
      DESIGN.title.size,
      titleSize,
      TITLE_FONT,
      COLORS.name,
      "LEFT",
    ),
  ];

  if (level) {
    items.push(
      text(
        level,
        titleLeft + (nameWidth + gap) * fit,
        DESIGN.title.top,
        levelWidth * fit + slack,
        DESIGN.title.size,
        titleSize,
        TITLE_FONT,
        COLORS.level,
        "LEFT",
      ),
    );
  }

  TILE_NAMES.forEach((tileName, index) => {
    const setting = getElementAffinitySetting(settings, tileName);
    const affinity = ELEMENT_AFFINITIES.find(
      (option) => option.value === setting.affinity,
    );

    if (!affinity) {
      throw new Error(
        `Unknown affinity "${setting.affinity}" for ${tileName}.`,
      );
    }

    const canView = isGameMaster || setting.visible;
    const x = DESIGN.sidePadding + index * DESIGN.iconSize;
    const image = buildImage(
      {
        url: tileUrl(tileName),
        mime: "image/png",
        width: TILE_IMAGE_SIZE,
        height: TILE_IMAGE_SIZE,
      },
      // This dpi makes the image exactly one icon wide in the scene.
      {
        dpi: (TILE_IMAGE_SIZE * sceneDpi) / (DESIGN.iconSize * k),
        offset: { x: 0, y: 0 },
      },
    );

    items.push(
      common(image, 3)
        .position({ x: left + x * k, y: top + DESIGN.iconTop * k })
        .build(),
      text(
        canView ? affinity.display : "?",
        x,
        DESIGN.iconTop + DESIGN.iconSize,
        DESIGN.iconSize,
        DESIGN.labelHeight,
        DESIGN.labelSize,
        LABEL_FONT,
        COLORS.label,
        "CENTER",
      ),
    );
  });

  return items;
}

export async function initializeTokenOverlays(): Promise<void> {
  const overlays = new Map<string, Overlay>();
  let running = false;
  let again = false;

  const syncOnce = async (): Promise<void> => {
    if (!(await OBR.scene.isReady())) {
      overlays.clear();
      return;
    }

    const [items, role, sceneDpi] = await Promise.all([
      OBR.scene.items.getItems(),
      OBR.player.getRole(),
      OBR.scene.grid.getDpi(),
    ]);
    const enabled = new Set<string>();

    for (const token of items) {
      if (!isTokenItem(token)) {
        continue;
      }

      try {
        if (!readTokenDisplaySettings(token).usePlugin) {
          continue;
        }

        enabled.add(token.id);

        // Only rebuild when something that affects the card has changed.
        const signature = JSON.stringify([
          token,
          role,
          sceneDpi,
        ], (key, value: unknown) =>
          key === "lastModified" || key === "lastModifiedUserId"
            ? undefined
            : value,
        );
        const previous = overlays.get(token.id);

        if (previous?.signature === signature) {
          continue;
        }

        const next = await buildOverlay(token, role === "GM", sceneDpi);

        // Add before deleting so the card doesn't flicker.
        await OBR.scene.local.addItems(next);
        overlays.set(token.id, {
          signature,
          itemIds: next.map((item) => item.id),
        });

        if (previous) {
          await OBR.scene.local.deleteItems(previous.itemIds);
        }
      } catch (error) {
        console.error(`Failed to draw the card for token "${token.id}".`, error);
      }
    }

    for (const [tokenId, overlay] of overlays) {
      if (!enabled.has(tokenId)) {
        await OBR.scene.local.deleteItems(overlay.itemIds);
        overlays.delete(tokenId);
      }
    }
  };

  // Runs one sync at a time; changes arriving mid-sync trigger one more pass.
  const sync = async (): Promise<void> => {
    again = true;

    if (running) {
      return;
    }

    running = true;

    try {
      while (again) {
        again = false;
        await syncOnce();
      }
    } finally {
      running = false;
    }
  };

  const requestSync = (): void => {
    void sync().catch((error: unknown) => {
      console.error("Failed to update token cards.", error);
    });
  };

  // Remove cards left over from an earlier load of the extension.
  if (await OBR.scene.isReady()) {
    const stale = await OBR.scene.local.getItems(
      (item) => item.metadata[OVERLAY_KEY] !== undefined,
    );

    if (stale.length > 0) {
      await OBR.scene.local.deleteItems(stale.map((item) => item.id));
    }
  }

  OBR.scene.items.onChange(requestSync);
  OBR.scene.grid.onChange(requestSync);
  OBR.player.onChange(requestSync);
  OBR.scene.onReadyChange((ready) => {
    // Local items don't survive a scene change.
    overlays.clear();

    if (ready) {
      requestSync();
    }
  });
  requestSync();
}
