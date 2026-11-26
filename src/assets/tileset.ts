export const TILE_SIZE = 16;
export const TILESET_COLUMNS = 18;
export const TILESET_ROWS = 2;
export const TILESET_IMAGE = `${import.meta.env.BASE_URL}images/tiles_tightly_packed.png`;

type TileCoordinate = {
  column: number;
  row: number;
};

export const tiles = {
  slash: { column: 0, row: 0 },
  bludgeon: { column: 1, row: 0 },
  pierce: { column: 2, row: 0 },
  fire: { column: 3, row: 0 },
  ice: { column: 4, row: 0 },
  electric: { column: 5, row: 0 },
  psychic: { column: 6, row: 0 },
  bless: { column: 7, row: 0 },
  curse: { column: 8, row: 0 },
  poison: { column: 12, row: 0 },
  force: { column: 0, row: 1 },
  thunder: {column: 2, row: 1},
  acid: {column: 13, row: 0}
} as const satisfies Record<string, TileCoordinate>;

export type TileName = keyof typeof tiles;

export type TileStyle = {
  width: number;
  height: number;
  backgroundImage: string;
  backgroundPosition: string;
  backgroundRepeat: "no-repeat";
  imageRendering: "pixelated";
};

export function getTileStyle(name: TileName): TileStyle {
  const { column, row } = tiles[name];

  return {
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundImage: `url("${TILESET_IMAGE}")`,
    backgroundPosition: `-${column * TILE_SIZE}px -${row * TILE_SIZE}px`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
  };
}
