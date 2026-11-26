import OBR, {
  type Item,
  type ToolContext,
  type ToolEvent,
  type Vector2,
} from "@owlbear-rodeo/sdk";
import { getTileStyle, tiles, type TileName } from "./assets/tileset";
import {
  ELEMENT_AFFINITIES,
  getElementAffinitySetting,
  isElementAffinity,
  isTokenItem,
  readElementAffinities,
  saveElementAffinities,
  type ElementAffinityMap,
} from "./elementAffinities";

const EXTENSION_ID = "iamboredomincarnate/persona-ui";
const HOVER_TOOL_ID = `${EXTENSION_ID}/hover-tool`;
const HOVER_MODE_ID = `${HOVER_TOOL_ID}/mode`;
const HOVER_POPOVER_ID = `${EXTENSION_ID}/hover-menu`;
const ASSIGN_CONTEXT_MENU_ID = `${EXTENSION_ID}/assign-elements`;
const TILE_NAMES = Object.keys(tiles) as TileName[];
const TILE_GAP = 4;
const TILE_WIDTH = 36;
const MENU_PADDING = 8;
const HOVER_MENU_WIDTH =
  TILE_NAMES.length * TILE_WIDTH +
  Math.max(0, TILE_NAMES.length - 1) * TILE_GAP +
  MENU_PADDING * 2 +
  2;
const HOVER_MENU_HEIGHT = 52;
const ASSIGN_MENU_HEIGHT = 540;
const EXTENSION_ICON = new URL(
  `${import.meta.env.BASE_URL}icon.svg`,
  window.location.href,
).toString();

function pageUrl(view: "tiles" | "assign", tokenId?: string): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set("view", view);

  if (tokenId) {
    url.searchParams.set("tokenId", tokenId);
  }

  return url.toString();
}

function createIcon(name: TileName): HTMLSpanElement {
  const icon = document.createElement("span");
  const style = getTileStyle(name);

  icon.className = "element-icon";
  icon.setAttribute("role", "img");
  icon.setAttribute("aria-label", name);
  Object.assign(icon.style, {
    ...style,
    width: `${style.width}px`,
    height: `${style.height}px`,
  });

  return icon;
}

function showPageError(container: HTMLElement, message: string): void {
  const error = document.createElement("p");
  error.className = "menu-error";
  error.setAttribute("role", "alert");
  error.textContent = message;
  container.replaceChildren(error);
}

function anchorBelowToken(token: Item): Promise<Vector2> {
  return OBR.scene.items.getItemBounds([token.id]).then((bounds) =>
    OBR.viewport.transformPoint({
      x: bounds.center.x,
      y: bounds.max.y,
    }),
  );
}

async function registerAssignContextMenu(): Promise<void> {
  await OBR.contextMenu.create({
    id: ASSIGN_CONTEXT_MENU_ID,
    icons: [
      {
        icon: EXTENSION_ICON,
        label: "Assign Elements",
        filter: {
          min: 1,
          max: 1,
        },
      },
    ],
    embed: {
      url: pageUrl("assign"),
      height: ASSIGN_MENU_HEIGHT,
    },
  });
}

function isPointerInHoverMenu(
  pointer: Vector2,
  anchor: Vector2,
): boolean {
  return (
    pointer.x >= anchor.x - HOVER_MENU_WIDTH / 2 &&
    pointer.x <= anchor.x + HOVER_MENU_WIDTH / 2 &&
    pointer.y >= anchor.y &&
    pointer.y <= anchor.y + HOVER_MENU_HEIGHT
  );
}

export async function initializeTokenTileMenu(): Promise<void> {
  let hoveredTokenId: string | undefined;
  let hoverVersion = 0;
  let leaveTimer: number | undefined;
  let lastPointerPosition: Vector2 | undefined;

  const reportError = (error: unknown): void => {
    console.error("Failed to update the token tile menu.", error);
  };

  const cancelLeaveTimer = (): void => {
    if (leaveTimer !== undefined) {
      window.clearTimeout(leaveTimer);
      leaveTimer = undefined;
    }
  };

  const clearHover = async (): Promise<void> => {
    const wasHovered = hoveredTokenId !== undefined;
    hoverVersion += 1;
    hoveredTokenId = undefined;
    cancelLeaveTimer();

    if (wasHovered) {
      await OBR.popover.close(HOVER_POPOVER_ID);
    }
  };

  const showHoveredToken = async (token: Item): Promise<void> => {
    if (hoveredTokenId === token.id) {
      return;
    }

    const currentVersion = ++hoverVersion;
    hoveredTokenId = token.id;
    const anchor = await anchorBelowToken(token);

    if (currentVersion !== hoverVersion) {
      return;
    }

    await OBR.popover.open({
      id: HOVER_POPOVER_ID,
      url: pageUrl("tiles", token.id),
      width: HOVER_MENU_WIDTH,
      height: HOVER_MENU_HEIGHT,
      anchorReference: "POSITION",
      anchorPosition: { left: anchor.x, top: anchor.y },
      anchorOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
      transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
      hidePaper: true,
    });
  };

  const handleToolMove = (_context: ToolContext, event: ToolEvent): void => {
    lastPointerPosition = event.pointerPosition;
    const target = event.target;

    if (target && isTokenItem(target)) {
      cancelLeaveTimer();
      void showHoveredToken(target).catch(reportError);
      return;
    }

    if (!hoveredTokenId || leaveTimer !== undefined) {
      return;
    }

    const tokenId = hoveredTokenId;
    leaveTimer = window.setTimeout(() => {
      leaveTimer = undefined;
      const pointer = lastPointerPosition;

      if (!pointer || hoveredTokenId !== tokenId) {
        return;
      }

      void OBR.scene.items
        .getItems([tokenId])
        .then(([token]) => {
          if (!token || !isTokenItem(token)) {
            return clearHover();
          }

          return Promise.all([
            anchorBelowToken(token),
            OBR.viewport.transformPoint(pointer),
          ]).then(([anchor, screenPointer]) => {
            if (!isPointerInHoverMenu(screenPointer, anchor)) {
              return clearHover();
            }
          });
        })
        .catch(reportError);
    }, 120);
  };

  await registerAssignContextMenu();
  await OBR.tool.create({
    id: HOVER_TOOL_ID,
    icons: [{ icon: EXTENSION_ICON, label: "Element Hover" }],
    defaultMode: HOVER_MODE_ID,
  });
  await OBR.tool.createMode({
    id: HOVER_MODE_ID,
    icons: [{ icon: EXTENSION_ICON, label: "Element Hover" }],
    onToolMove: handleToolMove,
  });

  OBR.scene.items.onChange((items) => {
    const tokenId = hoveredTokenId;
    const token = tokenId
      ? items.find((item) => item.id === tokenId)
      : undefined;

    if (!tokenId || !token) {
      return;
    }

    if (!isTokenItem(token)) {
      void clearHover().catch(reportError);
      return;
    }

    const version = hoverVersion;
    void anchorBelowToken(token)
      .then((anchor) => {
        if (hoveredTokenId !== tokenId || version !== hoverVersion) {
          return;
        }

        return OBR.popover.open({
          id: HOVER_POPOVER_ID,
          url: pageUrl("tiles", tokenId),
          width: HOVER_MENU_WIDTH,
          height: HOVER_MENU_HEIGHT,
          anchorReference: "POSITION",
          anchorPosition: { left: anchor.x, top: anchor.y },
          anchorOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
          transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
          hidePaper: true,
        });
      })
      .catch(reportError);
  });

  OBR.tool.onToolChange((activeToolId) => {
    if (activeToolId !== HOVER_TOOL_ID) {
      void clearHover().catch(reportError);
    }
  });

  await OBR.tool.activateTool(HOVER_TOOL_ID);
}

export function renderTokenTileMenu(tokenId: string | null): void {
  const menu = document.createElement("div");
  menu.className = "tile-menu";
  menu.setAttribute("role", "group");
  menu.setAttribute("aria-label", "Element affinities");
  document.documentElement.classList.add("tile-menu-page");
  document.body.classList.add("tile-menu-page");
  document.body.replaceChildren(menu);

  if (!tokenId) {
    showPageError(menu, "No token was provided for this element menu.");
    return;
  }

  OBR.onReady(() => {
    let isGameMaster = false;

    const render = async (): Promise<void> => {
      const [token] = await OBR.scene.items.getItems([tokenId]);

      if (!token || !isTokenItem(token)) {
        showPageError(menu, "This token is no longer available.");
        return;
      }

      const settings = readElementAffinities(token);
      const cards = TILE_NAMES.map((name) => {
        const setting = getElementAffinitySetting(settings, name);
        const affinity = ELEMENT_AFFINITIES.find(
          (option) => option.value === setting.affinity,
        );

        if (!affinity) {
          throw new Error(`Unknown affinity "${setting.affinity}" for ${name}.`);
        }

        const card = document.createElement("div");
        const status = document.createElement("span");
        const canView = isGameMaster || setting.visible;
        const value = canView ? affinity.display : "?";

        card.className = "element-card";
        card.title = name;
        card.append(createIcon(name));

        status.className = canView
          ? `element-status element-status--${setting.affinity}`
          : "element-status element-status--unknown";
        status.textContent = value ?? "?";
        status.setAttribute(
          "aria-label",
          `${name}: ${value === "?" ? "unknown" : affinity.label}`,
        );
        card.append(status);
        return card;
      });

      menu.replaceChildren(...cards);
    };

    void OBR.player
      .getRole()
      .then((role) => {
        isGameMaster = role === "GM";
        return render();
      })
      .catch((error: unknown) => {
        console.error("Failed to render element affinities.", error);
        showPageError(menu, "Unable to load this token's element affinities.");
      });

    OBR.scene.items.onChange((items) => {
      if (items.some((item) => item.id === tokenId)) {
        void render().catch((error: unknown) => {
          console.error("Failed to refresh element affinities.", error);
          showPageError(menu, "Unable to refresh this token's affinities.");
        });
      }
    });
  });
}

export function renderElementAssignmentMenu(tokenId: string | null): void {
  const panel = document.createElement("main");
  panel.className = "assignment-menu";
  document.documentElement.classList.add("assignment-menu-page");
  document.body.classList.add("assignment-menu-page");
  document.body.replaceChildren(panel);

  OBR.onReady(() => {
    void (async () => {
      let selectedTokenId = tokenId;

      if (!selectedTokenId) {
        const selection = await OBR.player.getSelection();

        if (!selection || selection.length !== 1) {
          showPageError(panel, "Select a single token to assign its elements.");
          return;
        }

        selectedTokenId = selection[0];
      }

      await initializeAssignmentForm(panel, selectedTokenId);
    })().catch((error: unknown) => {
      console.error("Failed to open the element assignment menu.", error);
      showPageError(panel, "Unable to load element assignments.");
    });
  });
}

async function initializeAssignmentForm(
  panel: HTMLElement,
  tokenId: string,
): Promise<void> {
  if ((await OBR.player.getRole()) !== "GM") {
    showPageError(panel, "Only the GM can assign element affinities.");
    return;
  }

  const [token] = await OBR.scene.items.getItems([tokenId]);

  if (!token || !isTokenItem(token)) {
    showPageError(panel, "This token is no longer available.");
    return;
  }

  const settings = readElementAffinities(token);
  const form = document.createElement("form");
  const heading = document.createElement("h1");
  const description = document.createElement("p");
  const rows = document.createElement("div");
  const error = document.createElement("p");
  const actions = document.createElement("div");
  const saveButton = document.createElement("button");
  const controls = new Map<
    TileName,
    { affinity: HTMLSelectElement; visible: HTMLInputElement }
  >();

  form.className = "assignment-form";
  heading.textContent = "Assign Elements";
  description.className = "assignment-description";
  description.textContent =
    "Set each affinity and choose whether players can see it.";
  rows.className = "affinity-list";
  error.className = "assignment-error";
  error.setAttribute("role", "alert");
  actions.className = "assignment-actions";
  saveButton.type = "submit";
  saveButton.textContent = "Save Changes";

  for (const name of TILE_NAMES) {
    const setting = getElementAffinitySetting(settings, name);
    const row = document.createElement("div");
    const nameLabel = document.createElement("span");
    const affinity = document.createElement("select");
    const visibilityLabel = document.createElement("label");
    const visible = document.createElement("input");
    const visibilityText = document.createElement("span");

    row.className = "affinity-row";
    nameLabel.className = "affinity-name";
    nameLabel.textContent = name;
    affinity.setAttribute("aria-label", `${name} affinity`);

    for (const option of ELEMENT_AFFINITIES) {
      const optionElement = document.createElement("option");
      optionElement.value = option.value;
      optionElement.textContent = `${option.label} (${option.display})`;
      optionElement.selected = option.value === setting.affinity;
      affinity.append(optionElement);
    }

    visibilityLabel.className = "affinity-visibility";
    visible.type = "checkbox";
    visible.checked = setting.visible;
    visible.setAttribute("aria-label", `Show ${name} affinity to players`);
    visibilityText.textContent = "Show";
    visibilityLabel.append(visible, visibilityText);
    row.append(createIcon(name), nameLabel, affinity, visibilityLabel);
    rows.append(row);
    controls.set(name, { affinity, visible });
  }

  actions.append(saveButton);
  form.append(heading, description, rows, error, actions);
  panel.replaceChildren(form);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const updated: ElementAffinityMap = {};

    for (const name of TILE_NAMES) {
      const control = controls.get(name);
      const affinity = control?.affinity.value;

      if (!control || !isElementAffinity(affinity)) {
        error.textContent = `Choose a valid affinity for ${name}.`;
        return;
      }

      updated[name] = {
        affinity,
        visible: control.visible.checked,
      };
    }

    saveButton.disabled = true;
    error.textContent = "";
    void saveElementAffinities(tokenId, updated)
      .then(() => {
        error.className = "assignment-status";
        error.setAttribute("role", "status");
        error.textContent = "Saved.";
        saveButton.disabled = false;
      })
      .catch((saveError: unknown) => {
        console.error("Failed to save element affinities.", saveError);
        error.className = "assignment-error";
        error.setAttribute("role", "alert");
        error.textContent = "Unable to save. Check token permissions and retry.";
        saveButton.disabled = false;
      });
  });
}
