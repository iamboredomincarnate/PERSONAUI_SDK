import OBR from "@owlbear-rodeo/sdk";
import { getTileStyle, tiles, type TileName } from "./assets/tileset";
import {
  applyElementAffinitySettings,
  ELEMENT_AFFINITIES,
  ELEMENT_AFFINITY_METADATA_KEY,
  getElementAffinitySetting,
  isElementAffinity,
  isElementAffinityNameCurrent,
  isTokenItem,
  readElementAffinities,
  readTokenDisplaySettings,
  saveElementAffinities,
  saveTokenPluginSetting,
  syncTokenMemory,
  type ElementAffinityMap,
} from "./elementAffinities";
import { initializeTokenOverlays } from "./TokenOverlay";

const EXTENSION_ID = "iamboredomincarnate/persona-ui";
const ASSIGN_CONTEXT_MENU_ID = `${EXTENSION_ID}/assign-elements`;
const TILE_NAMES = Object.keys(tiles) as TileName[];
const ASSIGN_MENU_HEIGHT = 700;
const EXTENSION_ICON = new URL(
  `${import.meta.env.BASE_URL}icon.svg`,
  window.location.href,
).toString();

function pageUrl(view: "assign", tokenId?: string): string {
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

async function syncExistingTokenNames(): Promise<void> {
  if ((await OBR.player.getRole()) !== "GM") {
    return;
  }

  const tokens = (await OBR.scene.items.getItems()).filter(
    (item) =>
      isTokenItem(item) &&
      item.metadata[ELEMENT_AFFINITY_METADATA_KEY] !== undefined &&
      !isElementAffinityNameCurrent(item),
  );

  if (tokens.length === 0) {
    return;
  }

  await OBR.scene.items.updateItems(tokens, (drafts) => {
    for (const token of drafts) {
      applyElementAffinitySettings(token, readElementAffinities(token));
    }
  });
}

async function syncExistingTokenMemory(): Promise<void> {
  if ((await OBR.player.getRole()) !== "GM") {
    return;
  }

  const tokens = (await OBR.scene.items.getItems()).filter(isTokenItem);

  await syncTokenMemory(tokens.map((token) => token.id));
}

async function registerAssignContextMenu(): Promise<void> {
  await OBR.contextMenu.create({
    id: ASSIGN_CONTEXT_MENU_ID,
    icons: [
      {
        icon: EXTENSION_ICON,
        label: "Assign Elements",
      },
    ],
    embed: {
      url: pageUrl("assign"),
      height: ASSIGN_MENU_HEIGHT,
    },
  });
}

export async function initializeTokenTileMenu(): Promise<void> {
  await registerAssignContextMenu();
  await syncExistingTokenNames().catch((error: unknown) => {
    console.error("Failed to sync existing token affinity names.", error);
  });
  await syncExistingTokenMemory().catch((error: unknown) => {
    console.error("Failed to sync token memory.", error);
  });
  OBR.scene.items.onChange((items) => {
    void (async () => {
      if ((await OBR.player.getRole()) !== "GM") {
        return;
      }

      await syncTokenMemory(
        items
          .filter(isTokenItem)
          .map((item) => item.id),
      );
    })().catch((error: unknown) => {
      console.error("Failed to synchronize token memory.", error);
    });
  });
  await initializeTokenOverlays();
}

// Token cards are now scene items (see tokenOverlay.ts). This stays as an empty
// export so existing callers still compile; remove it along with the "tiles" view.
export function renderTokenTileMenu(_tokenId: string | null): void {}

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
  const levelField = document.createElement("label");
  const levelLabel = document.createElement("span");
  const levelInput = document.createElement("input");
  const unknownLevelLabel = document.createElement("label");
  const unknownLevelInput = document.createElement("input");
  const unknownLevelText = document.createElement("span");
  const usePluginLabel = document.createElement("label");
  const usePluginInput = document.createElement("input");
  const usePluginText = document.createElement("span");
  const controls = new Map<
    TileName,
    { affinity: HTMLSelectElement; visible: HTMLInputElement }
  >();
  const displaySettings = readTokenDisplaySettings(token);
  let savedPluginSetting = displaySettings.usePlugin;
  let isSavingPluginSetting = false;

  form.className = "assignment-form";
  heading.textContent = "Assign Elements";
  description.className = "assignment-description";
  description.textContent =
    "Set each affinity and choose whether players can see it.";
  levelField.className = "level-field";
  levelLabel.textContent = "Level";
  levelInput.type = "number";
  levelInput.min = "0";
  levelInput.step = "1";
  levelInput.value = String(displaySettings.level);
  levelInput.setAttribute("aria-label", "Token level");
  unknownLevelLabel.className = "unknown-level";
  unknownLevelInput.type = "checkbox";
  unknownLevelInput.checked = displaySettings.unknownLevel;
  unknownLevelText.textContent = "Show level as ???";
  unknownLevelLabel.append(unknownLevelInput, unknownLevelText);
  levelField.append(levelLabel, levelInput);
  usePluginLabel.className = "use-plugin";
  usePluginInput.type = "checkbox";
  usePluginInput.checked = displaySettings.usePlugin;
  usePluginText.textContent = "Use This Plugin";
  usePluginLabel.append(usePluginInput, usePluginText);
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
  form.append(
    heading,
    description,
    levelField,
    unknownLevelLabel,
    usePluginLabel,
    rows,
    error,
    actions,
  );
  panel.replaceChildren(form);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (isSavingPluginSetting) {
      return;
    }

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

    const level = levelInput.valueAsNumber;

    if (!Number.isSafeInteger(level) || level < 0) {
      error.textContent = "Level must be a non-negative whole number.";
      return;
    }

    saveButton.disabled = true;
    error.textContent = "";
    void saveElementAffinities(tokenId, updated, {
      level,
      unknownLevel: unknownLevelInput.checked,
      usePlugin: usePluginInput.checked,
    })
      .then(() => {
        error.className = "assignment-status";
        error.setAttribute("role", "status");
        error.textContent = "Saved.";
        savedPluginSetting = usePluginInput.checked;
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

  usePluginInput.addEventListener("change", () => {
    if (isSavingPluginSetting) {
      return;
    }

    isSavingPluginSetting = true;
    usePluginInput.disabled = true;
    saveButton.disabled = true;
    error.className = "assignment-error";
    error.setAttribute("role", "alert");
    error.textContent = "";

    void saveTokenPluginSetting(tokenId, usePluginInput.checked)
      .then(() => {
        savedPluginSetting = usePluginInput.checked;
        error.className = "assignment-status";
        error.setAttribute("role", "status");
        error.textContent = savedPluginSetting
          ? "Plugin enabled."
          : "Plugin disabled.";
      })
      .catch((saveError: unknown) => {
        console.error("Failed to update the plugin setting.", saveError);
        usePluginInput.checked = savedPluginSetting;
        error.className = "assignment-error";
        error.setAttribute("role", "alert");
        error.textContent = "Unable to update the plugin setting.";
      })
      .finally(() => {
        isSavingPluginSetting = false;
        usePluginInput.disabled = false;
        saveButton.disabled = false;
      });
  });
}