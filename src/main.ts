import OBR from "@owlbear-rodeo/sdk";
import { setupContextMenu } from "../contextMenu";
import {
  initializeTokenTileMenu,
  renderElementAssignmentMenu,
  renderTokenTileMenu,
} from "./tokenTileMenu";
import "./style.css";

const params = new URLSearchParams(window.location.search);
const view = params.get("view");

if (view === "tiles") {
  renderTokenTileMenu(params.get("tokenId"));
} else if (view === "assign") {
  renderElementAssignmentMenu(params.get("tokenId"));
} else {
  const connectionStatus = document.querySelector<HTMLParagraphElement>(
    "#connection-status",
  );
  const notificationButton = document.querySelector<HTMLButtonElement>(
    "#notification-button",
  );

  if (!connectionStatus || !notificationButton) {
    throw new Error("The extension page is missing required UI elements.");
  }

  if (OBR.isAvailable) {
    OBR.onReady(() => {
      connectionStatus.textContent = "Connected to Owlbear Rodeo.";
      notificationButton.disabled = false;
      setupContextMenu();
      void initializeTokenTileMenu().catch((error: unknown) => {
        console.error("Failed to initialize token tile menus.", error);
        connectionStatus.textContent =
          "Connected, but the token menu could not be initialized.";
      });
    });
  } else {
    connectionStatus.textContent =
      "Not connected. Open this extension from an Owlbear Rodeo room.";
  }

  notificationButton.addEventListener("click", () => {
    OBR.notification.show("Your Owlbear Rodeo extension is connected.");
  });
}
