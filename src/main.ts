import OBR from "@owlbear-rodeo/sdk";
import {
  initializeTokenTileMenu,
  renderTokenTileMenu,
} from "./tokenTileMenu";
import "./style.css";

if (new URLSearchParams(window.location.search).get("view") === "tiles") {
  renderTokenTileMenu();
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
      initializeTokenTileMenu();
    });
  } else {
    connectionStatus.textContent =
      "Not connected. Open this extension from an Owlbear Rodeo room.";
  }

  notificationButton.addEventListener("click", () => {
    OBR.notification.show("Your Owlbear Rodeo extension is connected.");
  });
}
