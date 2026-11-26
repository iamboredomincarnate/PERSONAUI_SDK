import OBR from "@owlbear-rodeo/sdk";
const ID = "persona-sdk-context-menu";

export function setupContextMenu() {
    OBR.contextMenu.create({
        id: '${ID}/context-menu',
        icons: [
            {
                // icon: "icon", TODO
                label: "Define Enemy Traits",
                filter: {
                    every: [{key: "layer", value: "token"}],

                },

                
            },
        ],

        onClick() {},

    });
}