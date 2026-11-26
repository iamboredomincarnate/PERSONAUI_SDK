import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { getTileStyle, TILE_SIZE, tiles, type TileName } from "./assets/tileset";

const POPOVER_ID = "persona-sdk-token-tile-menu";
const TILE_GAP = 4;
const MENU_PADDING = 8;
const TILE_NAMES = Object.keys(tiles) as TileName[];

const menuWidth =
  TILE_NAMES.length * TILE_SIZE +
  Math.max(0, TILE_NAMES.length - 1) * TILE_GAP +
  MENU_PADDING * 2 +
  2;
const menuHeight = TILE_SIZE + MENU_PADDING * 2 + 2;

function isToken(item: Item): boolean {
  return item.layer === "CHARACTER" || item.layer === "PROP";
}

export function renderTokenTileMenu(): void {
  const menu = document.createElement("div");
  menu.className = "tile-menu";
  menu.setAttribute("role", "toolbar");
  menu.setAttribute("aria-label", "Token icons");

  for (const name of TILE_NAMES) {
    const icon = document.createElement("span");
    const style = getTileStyle(name);

    icon.className = "tile-menu-icon";
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", name);
    icon.title = name;
    Object.assign(icon.style, {
      ...style,
      width: `${style.width}px`,
      height: `${style.height}px`,
    });
    menu.append(icon);
  }

  document.documentElement.classList.add("tile-menu-page");
  document.body.classList.add("tile-menu-page");
  document.body.replaceChildren(menu);
}

export function initializeTokenTileMenu(): void {
  let activeTokenId: string | undefined;
  let selectionVersion = 0;

  const reportError = (error: unknown): void => {
    console.error("Failed to update the token tile menu.", error);
  };

  const closeMenu = async (): Promise<void> => {
    const wasOpen = activeTokenId !== undefined;
    activeTokenId = undefined;

    if (wasOpen) {
      await OBR.popover.close(POPOVER_ID);
    }
  };

  const positionMenu = async (token: Item): Promise<void> => {
    const bounds = await OBR.scene.items.getItemBounds([token.id]);
    const anchor = await OBR.viewport.transformPoint({
      x: bounds.center.x,
      y: bounds.max.y,
    });

    if (activeTokenId !== token.id) {
      return;
    }

    const url = new URL("?view=tiles", window.location.href).toString();
    await OBR.popover.open({
      id: POPOVER_ID,
      url,
      width: menuWidth,
      height: menuHeight,
      anchorReference: "POSITION",
      anchorPosition: { left: anchor.x, top: anchor.y },
      anchorOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
      transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
      hidePaper: true,
    });
  };

  const updateSelection = async (
    selection: string[] | undefined,
  ): Promise<void> => {
    const currentVersion = ++selectionVersion;

    if (!selection || selection.length !== 1) {
      await closeMenu();
      return;
    }

    const [token] = await OBR.scene.items.getItems(selection);

    if (currentVersion !== selectionVersion) {
      return;
    }

    if (!token || !isToken(token)) {
      await closeMenu();
      return;
    }

    activeTokenId = token.id;
    await positionMenu(token);
  };

  OBR.player.onChange((player) => {
    void updateSelection(player.selection).catch(reportError);
  });

  OBR.scene.items.onChange(() => {
    const tokenId = activeTokenId;

    if (!tokenId) {
      return;
    }

    void OBR.scene.items
      .getItems([tokenId])
      .then(([token]) => {
        if (activeTokenId !== tokenId) {
          return;
        }

        if (!token || !isToken(token)) {
          return closeMenu();
        }

        return positionMenu(token);
      })
      .catch(reportError);
  });

  void OBR.player
    .getSelection()
    .then(updateSelection)
    .catch(reportError);
}
