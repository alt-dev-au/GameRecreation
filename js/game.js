'use strict';

// ============================================================
//  CONSTANTS
// ============================================================

const TILE_SIZE = 40;   // px per tile
const VIEW_W    = 9;    // viewport tiles wide
const VIEW_H    = 9;    // viewport tiles tall

// Tile IDs
const T = Object.freeze({
  FLOOR:         0,
  WALL:          1,
  CHIP:          2,
  EXIT:          3,
  WATER:         4,
  FIRE:          5,
  ICE:           6,
  DIRT:          7,
  GRAVEL:        8,
  KEY_BLUE:      9,
  KEY_RED:       10,
  KEY_YELLOW:    11,
  KEY_GREEN:     12,
  DOOR_BLUE:     13,
  DOOR_RED:      14,
  DOOR_YELLOW:   15,
  DOOR_GREEN:    16,
  FLIPPERS:      17,
  FIRE_BOOTS:    18,
  ICE_SKATES:    19,
  SUCTION_BOOTS: 20,
  THIEF:         21,
  BOMB:          22,
  HINT:          23,
  TELEPORT:      24,
  FORCE_N:       25,
  FORCE_S:       26,
  FORCE_E:       27,
  FORCE_W:       28,
  TOGGLE_CLOSED: 29,
  TOGGLE_OPEN:   30,
  GREEN_BUTTON:  31,
  BLUE_BUTTON:   32,
  ICE_NE:        33,
  ICE_NW:        34,
  ICE_SE:        35,
  ICE_SW:        36,
});

// Entity types
const E = Object.freeze({
  PLAYER:    0,
  BLOCK:     1,
  BUG:       2,
  FIREBALL:  3,
  BALL:      4,
  TANK:      5,
  GLIDER:    6,
  TEETH:     7,
  WALKER:    8,
});

// Directions: 0=N 1=E 2=S 3=W
const D = Object.freeze({ N: 0, E: 1, S: 2, W: 3 });
const DX       = [ 0,  1,  0, -1];
const DY       = [-1,  0,  1,  0];
const OPPOSITE = [ 2,  3,  0,  1];
const LEFT_OF  = [ 3,  0,  1,  2];   // CCW turn
const RIGHT_OF = [ 1,  2,  3,  0];   // CW  turn

// Tile sets for quick lookup
const ICE_TILES = new Set([T.ICE, T.ICE_NE, T.ICE_NW, T.ICE_SE, T.ICE_SW]);
const FORCE_TILES = new Set([T.FORCE_N, T.FORCE_S, T.FORCE_E, T.FORCE_W]);
const KEY_TILES   = new Set([T.KEY_BLUE, T.KEY_RED, T.KEY_YELLOW, T.KEY_GREEN]);
const BOOT_TILES  = new Set([T.FLIPPERS, T.FIRE_BOOTS, T.ICE_SKATES, T.SUCTION_BOOTS]);
const DOOR_TILES  = new Set([T.DOOR_BLUE, T.DOOR_RED, T.DOOR_YELLOW, T.DOOR_GREEN]);
const ENEMY_BLOCKED_TILES = new Set([T.WALL, T.DIRT, T.TOGGLE_CLOSED]);

// Map key→door
const KEY_FOR_DOOR = {
  [T.DOOR_BLUE]:   T.KEY_BLUE,
  [T.DOOR_RED]:    T.KEY_RED,
  [T.DOOR_YELLOW]: T.KEY_YELLOW,
  [T.DOOR_GREEN]:  T.KEY_GREEN,
};

// Reusable (infinite) keys
const REUSABLE_KEYS = new Set([T.KEY_GREEN]);

// Preferred scan order when auto-orienting the player on 3D level start
const OPEN_DIR_SCAN = [D.E, D.N, D.S, D.W];

// Force floor direction map
const FORCE_DIR = {
  [T.FORCE_N]: D.N,
  [T.FORCE_S]: D.S,
  [T.FORCE_E]: D.E,
  [T.FORCE_W]: D.W,
};

// Ice corner slide: entering from direction d gives exit direction
// ICE_NE: can enter from S (exit E) or from W (exit N)
// ICE_NW: can enter from S (exit W) or from E (exit N)
// ICE_SE: can enter from N (exit E) or from W (exit S)
// ICE_SW: can enter from N (exit W) or from E (exit S)
const ICE_CORNER_REDIRECT = {
  [T.ICE_NE]: { [D.S]: D.E, [D.W]: D.N },
  [T.ICE_NW]: { [D.S]: D.W, [D.E]: D.N },
  [T.ICE_SE]: { [D.N]: D.E, [D.W]: D.S },
  [T.ICE_SW]: { [D.N]: D.W, [D.E]: D.S },
};

// ============================================================
//  LEVEL DATA  (verified 2-D integer arrays)
// ============================================================
//
//  Tile ID quick reference (same as T.* constants above):
//  0=FLOOR 1=WALL 2=CHIP 3=EXIT
//  4=WATER 5=FIRE 6=ICE  7=DIRT 8=GRAVEL
//  9=KEY_BLUE 10=KEY_RED 11=KEY_YELLOW 12=KEY_GREEN
//  13=DOOR_BLUE 14=DOOR_RED 15=DOOR_YELLOW 16=DOOR_GREEN
//  17=FLIPPERS 18=FIRE_BOOTS 19=ICE_SKATES 20=SUCTION_BOOTS
//  21=THIEF 22=BOMB 23=HINT 24=TELEPORT
//  25=FORCE_N 26=FORCE_S 27=FORCE_E 28=FORCE_W
//  29=TOGGLE_CLOSED 30=TOGGLE_OPEN 31=GREEN_BUTTON 32=BLUE_BUTTON

// Count chips in a map
function countChips(map) {
  let n = 0;
  for (const row of map) for (const t of row) if (t === T.CHIP) n++;
  return n;
}

/* ────────────────────────────────────────────────────────────
   LEVEL LAYOUT  (all maps are 16 cols × 16 rows)

   Every level shares the same outer structure:
   - Border walls (row 0 / row 15 / col 0 / col 15) = all 1s
   - Top corridor  : row 1,  cols 1-14 (all floor)
   - Left corridor : col 1,  rows 1-14 (all floor)
   - Right corridor: col 14, rows 1-14 (all floor)
   - Bottom corr.  : row 13, cols 1-14 (all floor)
   - Final row 14  : col 1-14 (varies per level)
   ──────────────────────────────────────────────────────────── */

// ── LEVEL 1: Lesson 1 ──────────────────────────────────────
// Two symmetric rooms connected by vertical slots and a middle
// corridor.  5 chips, no enemies, no time limit.
//
//  Connectivity sketch (W=wall block, gaps shown as spaces):
//    row 2: WW W[gap3]WWWWWWWWW[gap12]WW
//    row 6: WWWWWWW[gap7][gap8]WWWWWWWW
//    row 8: WWWWWWW[gap7][gap8]WWWWWWWW
//    row12: WW W[gap3]WWWWWWWWW[gap12]WW
//
//  Player (1,1) →  row1 open  →  col3 gap → upper room
//  upper room (rows 3-5, cols 3-12) → col 7/8 gap → middle corridor (row7)
//  middle corridor → col 7/8 gap  → lower room (rows 9-11, cols 3-12)
//  lower room → col3 gap → row13 → row14 (chips + exit)
const _L1_MAP = [
  //col: 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
  /*r0*/  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  /*r1*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // top corridor
  /*r2*/  [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1],  // wall, gap @ c3 & c12
  /*r3*/  [1, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 1, 1, 1],  // chips @ (4,3) (11,3)
  /*r4*/  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],  // upper room
  /*r5*/  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],  // upper room
  /*r6*/  [1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1],  // wall, gap @ c7 & c8
  /*r7*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // middle corridor
  /*r8*/  [1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1],  // wall, gap @ c7 & c8
  /*r9*/  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],  // lower room
  /*r10*/ [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],  // lower room
  /*r11*/ [1, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 1, 1, 1],  // chips @ (4,11)(11,11)
  /*r12*/ [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1],  // wall, gap @ c3 & c12
  /*r13*/ [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // bottom corridor
  /*r14*/ [1, 0, 0, 2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 1],  // chip(3,14) exit(8,14)
  /*r15*/ [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
// chips: (4,3) (11,3) (4,11) (11,11) (3,14) = 5   exit: (8,14)

// ── LEVEL 2: Under Lock and Key ────────────────────────────
// Blue key in row1.  Blue door seals middle (row5).
// Red key behind blue door (row8).  Red door seals lower (row10).
// 4 chips total.  No time limit.
const _L2_MAP = [
  /*r0*/  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  /*r1*/  [1, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // KEY_BLUE @ (6,1)
  /*r2*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // open
  /*r3*/  [1, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 1],  // chips @ (3,3)(12,3)
  /*r4*/  [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],
  /*r5*/  [1, 1, 1, 1, 1, 1,13, 1, 1, 1, 1, 1, 1, 1, 1, 1],  // DOOR_BLUE @ (6,5)
  /*r6*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // open (below door)
  /*r7*/  [1, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 1],  // chips @ (3,7)(12,7)
  /*r8*/  [1, 0, 1, 0, 1, 0, 0,10, 0, 0, 0, 1, 0, 1, 0, 1],  // KEY_RED @ (7,8)
  /*r9*/  [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],
  /*r10*/ [1, 1, 1, 1, 1, 1,14, 1, 1, 1, 1, 1, 1, 1, 1, 1],  // DOOR_RED @ (6,10)
  /*r11*/ [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // open (below 2nd door)
  /*r12*/ [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  /*r13*/ [1, 0, 1, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 1, 0, 1],  // EXIT @ (7,13)
  /*r14*/ [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  /*r15*/ [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
// chips: (3,3)(12,3)(3,7)(12,7) = 4   exit: (7,13)
// Path: pick key(6,1) → door(6,5) → pick red key(7,8) → door(6,10) → exit

// ── LEVEL 3: Swimming Lessons ──────────────────────────────
// WATER barrier (rows 6-8).  FLIPPERS @ (7,3) allow crossing.
// Fire barrier in lower area + FIRE_BOOTS @ (7,11) allow crossing.
// 4 chips; no time limit.
const _L3_MAP = [
  /*r0*/  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  /*r1*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  /*r2*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  /*r3*/  [1, 0, 1, 2, 1, 0, 0,17, 0, 0, 1, 2, 1, 0, 0, 1],  // chips(3,3)(11,3) flippers(7,3)
  /*r4*/  [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1],
  /*r5*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // last dry row above water
  /*r6*/  [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],  // WATER (need flippers)
  /*r7*/  [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],  // WATER
  /*r8*/  [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],  // WATER
  /*r9*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // first dry row below water
  /*r10*/ [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  /*r11*/ [1, 0, 1, 2, 1, 5, 5,18, 5, 5, 1, 2, 1, 0, 0, 1],  // chips(3,11)(11,11) fire_boots(7,11) fire
  /*r12*/ [1, 0, 1, 0, 1, 5, 5, 0, 5, 5, 1, 0, 1, 0, 0, 1],  // fire in middle (optional detour)
  /*r13*/ [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  /*r14*/ [1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 1],  // EXIT @ (7,14)
  /*r15*/ [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
// chips: (3,3)(11,3)(3,11)(11,11) = 4   exit: (7,14)
// Path: grab flippers(7,3) → swim across water(r6-r8) → grab fire_boots(7,11) → reach exit

// ── LEVEL 4: Bug Bash ──────────────────────────────────────
// Same room structure as L1 but with 6 chips (2 extra in row14)
// and three enemies.  Time limit = 200 s.
//   Ball @ (7,7) → bounces E/W along the middle corridor
//   Bug  @ (7,4) → left-wall follows the upper room
//   Fireball @ (7,10) → right-wall follows the lower room
const _L4_MAP = [
  /*r0*/  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  /*r1*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  /*r2*/  [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1],
  /*r3*/  [1, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 1, 1, 1],  // chips @ (4,3)(11,3)
  /*r4*/  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],  // upper room (bug patrols here)
  /*r5*/  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  /*r6*/  [1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1],
  /*r7*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // middle corridor (ball patrols)
  /*r8*/  [1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1],
  /*r9*/  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],  // lower room (fireball patrols)
  /*r10*/ [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  /*r11*/ [1, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 1, 1, 1],  // chips @ (4,11)(11,11)
  /*r12*/ [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1],
  /*r13*/ [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  /*r14*/ [1, 0, 0, 2, 0, 0, 0, 0, 3, 0, 0, 0, 2, 0, 0, 1],  // chips(3,14)(12,14) exit(8,14)
  /*r15*/ [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
// chips: (4,3)(11,3)(4,11)(11,11)(3,14)(12,14) = 6   exit: (8,14)

// ── LEVEL 5: The Gauntlet ──────────────────────────────────
// Combines water, fire, ice, force floors, keys/doors, and enemies.
// 8 chips total.  Time limit = 300 s.
//
// Zone A (rows 1-5):   dry area with blue key + chips
// Zone B (rows 6-8):   WATER barrier (flippers required)
// Zone C (rows 9-11):  fire + fire boots + chips (fire_boots required for inner section)
// Zone D (rows 12-14): ice corridor + force floors + chips + exit
const _L5_MAP = [
  /*r0*/  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  /*r1*/  [1, 0, 0, 0, 0, 0, 9, 0,17, 0, 0, 0, 0, 0, 0, 1],  // KEY_BLUE(6,1) FLIPPERS(8,1)
  /*r2*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  /*r3*/  [1, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 1],  // chips @ (3,3)(12,3)
  /*r4*/  [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],
  /*r5*/  [1, 1, 1, 1, 1, 1,13, 1, 1, 1, 1, 1, 1, 1, 1, 1],  // DOOR_BLUE @ (6,5) — barrier
  /*r6*/  [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],  // WATER
  /*r7*/  [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],  // WATER
  /*r8*/  [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],  // WATER
  /*r9*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  /*r10*/ [1, 0, 1, 2, 1, 5, 5,18, 5, 5, 1, 2, 1, 0, 0, 1],  // chips(3,10)(11,10) fire_boots(7,10)
  /*r11*/ [1, 0, 1, 0, 1, 5, 5, 0, 5, 5, 1, 0, 1, 0, 0, 1],  // fire zone
  /*r12*/ [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // ice + force corridor
  /*r13*/ [1, 6, 6, 6,27,27,27,27,27,27, 6, 6, 6, 6, 0, 1],  // ICE left, FORCE_E middle, ICE right
  /*r14*/ [1, 0, 0, 2, 0, 0, 0, 0, 3, 0, 0, 0, 2, 0, 0, 1],  // chips(3,14)(12,14) exit(8,14)
  /*r15*/ [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
// Level 5 chip positions: rows 3, 10, 12, 14 (8 chips total)

// ── Assemble LEVELS array ───────────────────────────────────

// Deep-copy a 2-D map array so game mutation doesn't affect the template
function _copyMap(src) { return src.map(row => [...row]); }

const LEVELS = [
  {
    number: 1,
    title:  'Lesson 1',
    hint:   'Collect all the computer chips ★, then find the exit!  Arrow keys or WASD to move.',
    timeLimit: 0,
    map:    _copyMap(_L1_MAP),
    playerStart: { x: 1, y: 1 },
    entities: [],
    width:  16,
    height: 16,
  },
  {
    number: 2,
    title:  'Under Lock and Key',
    hint:   'Coloured keys open matching doors.  Pick up the blue key first!',
    timeLimit: 0,
    map:    _copyMap(_L2_MAP),
    playerStart: { x: 1, y: 1 },
    entities: [],
    width:  16,
    height: 16,
  },
  {
    number: 3,
    title:  'Swimming Lessons',
    hint:   'Grab the flippers (💧) to swim across the water!  Fire boots (🔥) let you walk on fire.',
    timeLimit: 0,
    map:    _copyMap(_L3_MAP),
    playerStart: { x: 1, y: 1 },
    entities: [],
    width:  16,
    height: 16,
  },
  {
    number: 4,
    title:  'Bug Bash',
    hint:   'Watch out for enemies!  Bugs follow the left wall; fireballs follow the right.  Balls bounce straight.',
    timeLimit: 200,
    map:    _copyMap(_L4_MAP),
    playerStart: { x: 1, y: 1 },
    entities: [
      { type: E.BUG,      x: 7, y: 4,  dir: D.N },  // upper room
      { type: E.BALL,     x: 7, y: 7,  dir: D.E },  // middle corridor
      { type: E.FIREBALL, x: 7, y: 10, dir: D.S },  // lower room
    ],
    width:  16,
    height: 16,
  },
  {
    number: 5,
    title:  'The Gauntlet',
    hint:   'Use everything you have learned: keys, water, fire, ice, and force floors.  Watch for enemies!',
    timeLimit: 300,
    // Start from template and patch in extra chips for a total of 8
    map: (() => {
      const m = _copyMap(_L5_MAP);
      m[12][3]  = T.CHIP;   // extra chip @ (3,12)
      m[12][12] = T.CHIP;   // extra chip @ (12,12)
      return m;
    })(),
    playerStart: { x: 1, y: 1 },
    entities: [
      { type: E.BUG,      x: 7, y: 3,  dir: D.N },
      { type: E.FIREBALL, x: 7, y: 10, dir: D.W },
      { type: E.TEETH,    x: 7, y: 12, dir: D.S },
    ],
    width:  16,
    height: 16,
  },
];

// ============================================================
//  RENDERER
// ============================================================

const COLORS = {
  floor:     '#c8b890',
  wall:      '#607080',
  wallLight: '#8090a0',
  wallDark:  '#303840',
  chip:      '#ffd700',
  chipBg:    '#1a1a3a',
  exit:      '#00cc66',
  exitLock:  '#336644',
  water:     '#2266ff',
  waterFoam: '#4488ff',
  fire:      '#ff6600',
  fireTip:   '#ffcc00',
  ice:       '#aaddff',
  iceDark:   '#88bbdd',
  dirt:      '#996633',
  dirtDark:  '#774411',
  gravel:    '#888888',
  gravelDot: '#aaaaaa',
  hint:      '#aaaa00',
  teleport:  '#9933ff',
  bomb:      '#222222',
  thief:     '#660066',
  toggle:    '#ff8800',
  greenBtn:  '#00bb00',
  blueBtn:   '#0044bb',
  forceArr:  '#ffee88',
};

const KEY_COLORS   = { [T.KEY_BLUE]:'#2244ff',   [T.KEY_RED]:'#ee2222',   [T.KEY_YELLOW]:'#ffdd00', [T.KEY_GREEN]:'#22cc22'  };
const DOOR_COLORS  = { [T.DOOR_BLUE]:'#2244ff',  [T.DOOR_RED]:'#ee2222',  [T.DOOR_YELLOW]:'#ffdd00',[T.DOOR_GREEN]:'#22cc22' };
const BOOT_COLORS  = { [T.FLIPPERS]:'#2266ff',   [T.FIRE_BOOTS]:'#ff6600',[T.ICE_SKATES]:'#aaddff', [T.SUCTION_BOOTS]:'#888888' };
const BOOT_LABELS  = { [T.FLIPPERS]:'F',         [T.FIRE_BOOTS]:'🔥',      [T.ICE_SKATES]:'❄',      [T.SUCTION_BOOTS]:'S' };
const BOOT_ICONS   = { [T.FLIPPERS]:'💧',        [T.FIRE_BOOTS]:'🔥',      [T.ICE_SKATES]:'❄',      [T.SUCTION_BOOTS]:'〒' };
const ENEMY_COLORS = { [E.BUG]:'#cc0000', [E.FIREBALL]:'#ff6600', [E.BALL]:'#ff88ff', [E.TANK]:'#228822', [E.GLIDER]:'#880088', [E.TEETH]:'#ffcc00', [E.WALKER]:'#888888' };

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.ts     = TILE_SIZE;
    this.canvas.width  = VIEW_W * this.ts;
    this.canvas.height = VIEW_H * this.ts;
  }

  draw(game) {
    const ctx   = this.ctx;
    const ts    = this.ts;
    const px    = game.player.x;
    const py    = game.player.y;

    // Camera origin (top-left tile of viewport)
    const camX  = Math.max(0, Math.min(px - Math.floor(VIEW_W / 2), game.mapW - VIEW_W));
    const camY  = Math.max(0, Math.min(py - Math.floor(VIEW_H / 2), game.mapH - VIEW_H));

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw tiles
    for (let ty = 0; ty < VIEW_H; ty++) {
      for (let tx = 0; tx < VIEW_W; tx++) {
        const mx = camX + tx;
        const my = camY + ty;
        const sx = tx * ts;
        const sy = ty * ts;
        if (mx < 0 || my < 0 || mx >= game.mapW || my >= game.mapH) {
          this._drawWall(ctx, sx, sy);
        } else {
          this._drawTile(ctx, game.map[my][mx], sx, sy, game.chipsLeft, mx, my, game);
        }
      }
    }

    // Draw entities (blocks first, then enemies, then player on top)
    const sorted = [...game.entities].sort((a, b) => {
      const order = { [E.BLOCK]: 0, [E.PLAYER]: 2 };
      return (order[a.type] || 1) - (order[b.type] || 1);
    });
    for (const ent of sorted) {
      if (!ent.alive) continue;
      const sx = (ent.x - camX) * ts;
      const sy = (ent.y - camY) * ts;
      if (sx < -ts || sy < -ts || sx > VIEW_W * ts || sy > VIEW_H * ts) continue;
      this._drawEntity(ctx, ent, sx, sy);
    }
  }

  _drawTile(ctx, tile, sx, sy, chipsLeft, mx, my, game) {
    const ts = this.ts;
    // Base floor under everything
    this._drawFloor(ctx, sx, sy);

    switch (tile) {
      case T.FLOOR:   break;
      case T.WALL:    this._drawWall(ctx, sx, sy); break;
      case T.CHIP:    this._drawChip(ctx, sx, sy); break;
      case T.EXIT:    this._drawExit(ctx, sx, sy, chipsLeft === 0); break;
      case T.WATER:   this._drawWater(ctx, sx, sy); break;
      case T.FIRE:    this._drawFire(ctx, sx, sy); break;
      case T.ICE:
      case T.ICE_NE: case T.ICE_NW:
      case T.ICE_SE: case T.ICE_SW: this._drawIce(ctx, tile, sx, sy); break;
      case T.DIRT:    this._drawDirt(ctx, sx, sy); break;
      case T.GRAVEL:  this._drawGravel(ctx, sx, sy); break;
      case T.HINT:    this._drawHint(ctx, sx, sy); break;
      case T.TELEPORT: this._drawTeleport(ctx, sx, sy); break;
      case T.BOMB:    this._drawBomb(ctx, sx, sy); break;
      case T.THIEF:   this._drawThief(ctx, sx, sy); break;
      case T.TOGGLE_CLOSED: this._drawToggle(ctx, sx, sy, true); break;
      case T.TOGGLE_OPEN:   this._drawToggle(ctx, sx, sy, false); break;
      case T.GREEN_BUTTON: this._drawButton(ctx, sx, sy, COLORS.greenBtn); break;
      case T.BLUE_BUTTON:  this._drawButton(ctx, sx, sy, COLORS.blueBtn); break;
      case T.FORCE_N: case T.FORCE_S: case T.FORCE_E: case T.FORCE_W:
        this._drawForce(ctx, tile, sx, sy); break;
      default:
        if (KEY_TILES.has(tile))  this._drawKey(ctx, tile, sx, sy);
        if (DOOR_TILES.has(tile)) this._drawDoor(ctx, tile, sx, sy);
        if (BOOT_TILES.has(tile)) this._drawBoot(ctx, tile, sx, sy);
    }
  }

  _drawFloor(ctx, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(sx, sy, ts, ts);
    // subtle grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(sx + 0.25, sy + 0.25, ts - 0.5, ts - 0.5);
  }

  _drawWall(ctx, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(sx, sy, ts, ts);
    // 3-D bevel
    ctx.fillStyle = COLORS.wallLight;
    ctx.fillRect(sx, sy, ts, 3);
    ctx.fillRect(sx, sy, 3, ts);
    ctx.fillStyle = COLORS.wallDark;
    ctx.fillRect(sx, sy + ts - 3, ts, 3);
    ctx.fillRect(sx + ts - 3, sy, 3, ts);
  }

  _drawChip(ctx, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = COLORS.chipBg;
    ctx.fillRect(sx + 4, sy + 4, ts - 8, ts - 8);
    ctx.fillStyle = COLORS.chip;
    ctx.font = `bold ${ts - 10}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', sx + ts / 2, sy + ts / 2);
  }

  _drawExit(ctx, sx, sy, open) {
    const ts = this.ts;
    ctx.fillStyle = open ? COLORS.exit : COLORS.exitLock;
    ctx.fillRect(sx + 2, sy + 2, ts - 4, ts - 4);
    // checkerboard pattern
    const checker = open ? '#00aa55' : '#224433';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = checker;
          ctx.fillRect(sx + 2 + c * ((ts - 4) / 4), sy + 2 + r * ((ts - 4) / 4), (ts - 4) / 4, (ts - 4) / 4);
        }
      }
    }
    if (open) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 14px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', sx + ts / 2, sy + ts / 2);
    } else {
      ctx.fillStyle = '#aaccaa';
      ctx.font = `10px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOCK', sx + ts / 2, sy + ts / 2);
    }
  }

  _drawWater(ctx, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(sx, sy, ts, ts);
    ctx.fillStyle = COLORS.waterFoam;
    ctx.font = `${ts - 6}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('≈', sx + ts / 2, sy + ts / 2);
  }

  _drawFire(ctx, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = '#331100';
    ctx.fillRect(sx, sy, ts, ts);
    ctx.fillStyle = COLORS.fire;
    ctx.font = `${ts - 4}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔥', sx + ts / 2, sy + ts / 2);
  }

  _drawIce(ctx, tile, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = COLORS.ice;
    ctx.fillRect(sx, sy, ts, ts);
    ctx.fillStyle = COLORS.iceDark;
    ctx.font = `${ts - 8}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('❄', sx + ts / 2, sy + ts / 2);
    // corner indicator
    if (tile !== T.ICE) {
      ctx.strokeStyle = '#5599cc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (tile === T.ICE_NE) { ctx.moveTo(sx, sy + ts); ctx.lineTo(sx + ts, sy); }
      if (tile === T.ICE_NW) { ctx.moveTo(sx + ts, sy + ts); ctx.lineTo(sx, sy); }
      if (tile === T.ICE_SE) { ctx.moveTo(sx, sy); ctx.lineTo(sx + ts, sy + ts); }
      if (tile === T.ICE_SW) { ctx.moveTo(sx + ts, sy); ctx.lineTo(sx, sy + ts); }
      ctx.stroke();
    }
  }

  _drawDirt(ctx, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = COLORS.dirt;
    ctx.fillRect(sx, sy, ts, ts);
    // speckles
    ctx.fillStyle = COLORS.dirtDark;
    for (let i = 0; i < 6; i++) {
      const bx = sx + 6 + (i * 7) % (ts - 12);
      const by = sy + 6 + (i * 11) % (ts - 12);
      ctx.fillRect(bx, by, 3, 3);
    }
  }

  _drawGravel(ctx, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = COLORS.gravel;
    ctx.fillRect(sx, sy, ts, ts);
    ctx.fillStyle = COLORS.gravelDot;
    for (let i = 0; i < 10; i++) {
      const gx = sx + 4 + (i * 9) % (ts - 8);
      const gy = sy + 4 + (i * 7) % (ts - 8);
      ctx.beginPath();
      ctx.arc(gx, gy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawHint(ctx, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = COLORS.hint;
    ctx.fillRect(sx + 2, sy + 2, ts - 4, ts - 4);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${ts - 8}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', sx + ts / 2, sy + ts / 2);
  }

  _drawTeleport(ctx, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = COLORS.teleport;
    ctx.fillRect(sx + 2, sy + 2, ts - 4, ts - 4);
    ctx.fillStyle = '#cc88ff';
    ctx.font = `${ts - 8}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦', sx + ts / 2, sy + ts / 2);
  }

  _drawBomb(ctx, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(sx + ts / 2, sy + ts / 2 + 3, ts / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ff2200';
    ctx.fillRect(sx + ts / 2 - 2, sy + 4, 4, 8);
  }

  _drawThief(ctx, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = COLORS.thief;
    ctx.fillRect(sx + 2, sy + 2, ts - 4, ts - 4);
    ctx.fillStyle = '#cc44cc';
    ctx.font = `${ts - 8}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👤', sx + ts / 2, sy + ts / 2);
  }

  _drawToggle(ctx, sx, sy, closed) {
    const ts = this.ts;
    ctx.fillStyle = closed ? COLORS.toggle : COLORS.floor;
    ctx.fillRect(sx, sy, ts, ts);
    if (!closed) {
      ctx.strokeStyle = COLORS.toggle;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 2, sy + 2, ts - 4, ts - 4);
    }
  }

  _drawButton(ctx, sx, sy, color) {
    const ts = this.ts;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx + ts / 2, sy + ts / 2, ts / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawForce(ctx, tile, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = '#c8b030';
    ctx.fillRect(sx, sy, ts, ts);
    const dir = FORCE_DIR[tile];
    const arrowMap = { [D.N]: '↑', [D.S]: '↓', [D.E]: '→', [D.W]: '←' };
    ctx.fillStyle = COLORS.forceArr;
    ctx.font = `bold ${ts - 6}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(arrowMap[dir], sx + ts / 2, sy + ts / 2);
  }

  _drawKey(ctx, tile, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = KEY_COLORS[tile] || '#fff';
    ctx.beginPath();
    ctx.arc(sx + ts / 2, sy + ts / 3, ts / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(sx + ts / 2 - 3, sy + ts / 3, 6, ts / 2);
    ctx.fillRect(sx + ts / 2 - 3, sy + ts / 3 + ts / 4, 10, 5);
    ctx.fillRect(sx + ts / 2 - 3, sy + ts / 3 + ts / 4 + 8, 7, 5);
  }

  _drawDoor(ctx, tile, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = DOOR_COLORS[tile] || '#888';
    ctx.fillRect(sx + 4, sy, ts - 8, ts);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(sx + ts / 2 - 4, sy + ts / 2 - 4, 8, 8);
    ctx.fillStyle = '#ffee88';
    ctx.beginPath();
    ctx.arc(sx + ts / 2, sy + ts / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBoot(ctx, tile, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = BOOT_COLORS[tile] || '#888';
    ctx.fillRect(sx + 6, sy + 6, ts - 12, ts - 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${ts - 14}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(BOOT_ICONS[tile] || '?', sx + ts / 2, sy + ts / 2);
  }

  _drawEntity(ctx, ent, sx, sy) {
    if (ent.type === E.PLAYER)  this._drawPlayer(ctx, ent, sx, sy);
    else if (ent.type === E.BLOCK)   this._drawBlock(ctx, sx, sy);
    else                              this._drawEnemy(ctx, ent, sx, sy);
  }

  _drawPlayer(ctx, ent, sx, sy) {
    const ts = this.ts;
    // Body
    ctx.fillStyle = '#2244cc';
    ctx.fillRect(sx + 8, sy + 8, ts - 16, ts - 10);
    // Head
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath();
    ctx.arc(sx + ts / 2, sy + ts / 3, ts / 5, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#333';
    const eyeOff = ent.dir === D.E ? 3 : ent.dir === D.W ? -3 : 0;
    ctx.beginPath(); ctx.arc(sx + ts / 2 - 3 + eyeOff, sy + ts / 3 - 1, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + ts / 2 + 3 + eyeOff, sy + ts / 3 - 1, 2, 0, Math.PI * 2); ctx.fill();
    // Helmet
    ctx.fillStyle = '#1133aa';
    ctx.beginPath();
    ctx.arc(sx + ts / 2, sy + ts / 3, ts / 5, Math.PI, 0);
    ctx.fill();
    // Direction indicator
    ctx.fillStyle = '#ffdd00';
    ctx.font = `10px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
  }

  _drawBlock(ctx, sx, sy) {
    const ts = this.ts;
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(sx + 2, sy + 2, ts - 4, ts - 4);
    ctx.fillStyle = '#a07820';
    ctx.fillRect(sx + 2, sy + 2, ts - 4, 3);
    ctx.fillRect(sx + 2, sy + 2, 3, ts - 4);
    ctx.fillStyle = '#6a5010';
    ctx.fillRect(sx + 2, sy + ts - 5, ts - 4, 3);
    ctx.fillRect(sx + ts - 5, sy + 2, 3, ts - 4);
    ctx.fillStyle = '#ccaa40';
    ctx.font = `bold ${ts - 12}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('■', sx + ts / 2, sy + ts / 2);
  }

  _drawEnemy(ctx, ent, sx, sy) {
    const ts = this.ts;
    const col = ENEMY_COLORS[ent.type] || '#ff0000';
    ctx.fillStyle = col;

    switch (ent.type) {
      case E.BUG: {
        // Body
        ctx.beginPath();
        ctx.ellipse(sx + ts / 2, sy + ts / 2, ts / 2 - 6, ts / 2 - 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Legs
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(sx + ts / 2 - 10, sy + ts / 2 + i * 6);
          ctx.lineTo(sx + 4, sy + ts / 2 + i * 10);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sx + ts / 2 + 10, sy + ts / 2 + i * 6);
          ctx.lineTo(sx + ts - 4, sy + ts / 2 + i * 10);
          ctx.stroke();
        }
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(sx + ts / 2 - 5, sy + ts / 2 - 4, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + ts / 2 + 5, sy + ts / 2 - 4, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(sx + ts / 2 - 5, sy + ts / 2 - 4, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + ts / 2 + 5, sy + ts / 2 - 4, 2, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case E.FIREBALL: {
        ctx.font = `${ts - 4}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔥', sx + ts / 2, sy + ts / 2);
        break;
      }
      case E.BALL: {
        ctx.beginPath();
        ctx.arc(sx + ts / 2, sy + ts / 2, ts / 2 - 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffaaff';
        ctx.beginPath();
        ctx.arc(sx + ts / 2 - 5, sy + ts / 2 - 5, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case E.TANK: {
        ctx.fillRect(sx + 4, sy + 8, ts - 8, ts - 16);
        // gun barrel based on direction
        ctx.fillStyle = '#446644';
        const gunMap = { [D.N]: [ts/2-3, 2, 6, 14], [D.S]: [ts/2-3, ts-16, 6, 14], [D.E]: [ts-16, ts/2-3, 14, 6], [D.W]: [2, ts/2-3, 14, 6] };
        const g = gunMap[ent.dir];
        if (g) ctx.fillRect(sx + g[0], sy + g[1], g[2], g[3]);
        break;
      }
      case E.GLIDER: {
        // Arrow shape
        const arrowMap = { [D.N]: 270, [D.S]: 90, [D.E]: 0, [D.W]: 180 };
        const angle = ((arrowMap[ent.dir] || 0) * Math.PI) / 180;
        ctx.save();
        ctx.translate(sx + ts / 2, sy + ts / 2);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(ts / 2 - 6, 0);
        ctx.lineTo(-(ts / 2 - 6), -(ts / 2 - 8));
        ctx.lineTo(-(ts / 2 - 12), 0);
        ctx.lineTo(-(ts / 2 - 6), ts / 2 - 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      case E.TEETH: {
        ctx.beginPath();
        ctx.arc(sx + ts / 2, sy + ts / 2, ts / 2 - 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        for (let t = 0; t < 4; t++) {
          ctx.fillRect(sx + 8 + t * 6, sy + ts / 2, 4, 8);
        }
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(sx + ts / 2 - 5, sy + ts / 2 - 6, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + ts / 2 + 5, sy + ts / 2 - 6, 3, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case E.WALKER: {
        ctx.beginPath();
        ctx.arc(sx + ts / 2, sy + ts / 2, ts / 2 - 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#aaaaaa';
        ctx.font = `bold 14px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', sx + ts / 2, sy + ts / 2);
        break;
      }
      default: {
        ctx.beginPath();
        ctx.arc(sx + ts / 2, sy + ts / 2, ts / 2 - 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ============================================================
//  AUDIO (Web Audio API)
// ============================================================

class AudioManager {
  constructor() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      this.ctx = null;
    }
  }

  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _beep(freq, duration, type = 'square', vol = 0.15) {
    if (!this.ctx) return;
    this._resume();
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  collectChip()  { this._beep(880, 0.08, 'square', 0.12); }
  openDoor()     { this._beep(440, 0.12, 'triangle', 0.15); setTimeout(() => this._beep(660, 0.12, 'triangle', 0.15), 60); }
  levelComplete(){ this._beep(523, 0.1); setTimeout(() => this._beep(659, 0.1), 100); setTimeout(() => this._beep(784, 0.2), 200); }
  death()        { this._beep(200, 0.3, 'sawtooth', 0.2); setTimeout(() => this._beep(150, 0.4, 'sawtooth', 0.15), 150); }
  bump()         { this._beep(110, 0.05, 'sawtooth', 0.08); }
  pickupItem()   { this._beep(660, 0.1, 'triangle', 0.12); }
  splash()       { this._beep(300, 0.15, 'sawtooth', 0.1); }
}

// ============================================================
//  ENTITY STATE
// ============================================================

class EntityState {
  constructor(data) {
    this.type  = data.type;
    this.x     = data.x;
    this.y     = data.y;
    this.dir   = data.dir !== undefined ? data.dir : D.N;
    this.alive = true;
    // For teeth: skip every other tick
    this.skipTick = false;
    // For tank: reversed by blue button
    this.reversed = false;
  }
}

// ============================================================
//  GAME
// ============================================================

class Game {
  constructor() {
    this.currentLevel = 0;
    this.gameMode     = '2d';   // '2d' or '3d'
    this.audio        = new AudioManager();
    this.renderer     = null;
    this.running      = false;
    this.rafId        = null;

    // Input state
    this.keysHeld  = new Set();
    this.lastMove  = 0;      // timestamp of last player move
    this.moveDelay = 180;    // ms between moves when key held
    this.queuedDir = null;   // next direction from keydown

    this._bindInputs();
  }

  // ── Initialise / Load Level ────────────────────────────────

  loadLevel(index) {
    const def = LEVELS[index];

    // Deep copy the map so we can mutate it
    this.map   = def.map.map(row => [...row]);
    this.mapW  = def.width;
    this.mapH  = def.height;

    this.chipsTotal = countChips(this.map);
    this.chipsLeft  = this.chipsTotal;

    this.timeLimit    = def.timeLimit;
    this.timeElapsed  = 0;
    this.lastTick     = null;

    this.inventory = {
      keys:  { [T.KEY_BLUE]: 0, [T.KEY_RED]: 0, [T.KEY_YELLOW]: 0, [T.KEY_GREEN]: 0 },
      boots: new Set(),
    };

    this.player = new EntityState({ type: E.PLAYER, x: def.playerStart.x, y: def.playerStart.y, dir: D.S });

    // In 3D mode, orient the player toward the first open direction so they
    // don't spawn staring at a wall (all levels start in the top-left corner
    // where East leads into the opening corridor).
    if (this.gameMode === '3d') {
      this.player.dir = this._openStartDir(this.player.x, this.player.y);
    }

    this.entities = [
      this.player,
      ...def.entities.map(e => new EntityState(e)),
    ];

    // Collect teleport positions
    this.teleports = [];
    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        if (this.map[y][x] === T.TELEPORT) this.teleports.push({ x, y });
      }
    }

    this.dead      = false;
    this.won       = false;
    this.deathMsg  = '';
    this.hintShown = false;

    this._updateHUD(def);
  }

  // Return the first non-wall direction from (x,y); used to orient the
  // player on level start in 3D mode.
  _openStartDir(x, y) {
    for (const dir of OPEN_DIR_SCAN) {
      const nx = x + DX[dir];
      const ny = y + DY[dir];
      const tile = this.getTile(nx, ny);
      if (tile !== T.WALL && !DOOR_TILES.has(tile) && tile !== T.TOGGLE_CLOSED) {
        return dir;
      }
    }
    return D.E;
  }

  _updateHUD(def) {
    const el = id => document.getElementById(id);
    el('hud-level').textContent = def.number;
    el('hud-chips').textContent = this.chipsLeft;
    if (def.timeLimit > 0) {
      el('hud-time').textContent = def.timeLimit;
    } else {
      el('hud-time').textContent = '∞';
    }
    el('level-title-text').textContent = `Level ${def.number}: ${def.title}`;
    this._refreshInventoryHUD();
    this._hideHint();
  }

  _refreshInventoryHUD() {
    // Keys
    const keysEl = document.getElementById('hud-keys');
    keysEl.innerHTML = '';
    for (const [tile, count] of Object.entries(this.inventory.keys)) {
      for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = 'inv-item';
        div.style.background = KEY_COLORS[tile] || '#888';
        div.textContent = 'K';
        keysEl.appendChild(div);
      }
    }
    // Boots
    const bootsEl = document.getElementById('hud-boots');
    bootsEl.innerHTML = '';
    for (const boot of this.inventory.boots) {
      const div = document.createElement('div');
      div.className = 'inv-item';
      div.style.background = BOOT_COLORS[boot] || '#888';
      div.textContent = BOOT_LABELS[boot] || '?';
      bootsEl.appendChild(div);
    }
  }

  // ── Input ──────────────────────────────────────────────────

  _bindInputs() {
    const keyDirMap = {
      ArrowUp: D.N,    ArrowDown: D.S,  ArrowLeft: D.W,  ArrowRight: D.E,
      KeyW:    D.N,    KeyS:     D.S,   KeyA:     D.W,   KeyD:      D.E,
      w:       D.N,    s:        D.S,   a:        D.W,   d:         D.E,
    };

    document.addEventListener('keydown', e => {
      const dir = keyDirMap[e.code] || keyDirMap[e.key];
      if (dir !== undefined) {
        e.preventDefault();
        this.keysHeld.add(dir);
        this.queuedDir = dir;
      }
    });

    document.addEventListener('keyup', e => {
      const dir = keyDirMap[e.code] || keyDirMap[e.key];
      if (dir !== undefined) this.keysHeld.delete(dir);
    });

    // Mobile buttons
    const btnMap = { 'mc-up': D.N, 'mc-down': D.S, 'mc-left': D.W, 'mc-right': D.E };
    for (const [btnId, dir] of Object.entries(btnMap)) {
      const btn = document.getElementById(btnId);
      if (!btn) continue;

      const press = e => { e.preventDefault(); this.keysHeld.add(dir); this.queuedDir = dir; };
      const release = e => { e.preventDefault(); this.keysHeld.delete(dir); };

      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup',   release);
      btn.addEventListener('pointerleave',release);
    }

    // Touch swipe
    let touchStartX = 0, touchStartY = 0;
    document.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.queuedDir = dx > 0 ? D.E : D.W;
      } else {
        this.queuedDir = dy > 0 ? D.S : D.N;
      }
    }, { passive: true });

    // Hint close
    document.getElementById('hint-close').addEventListener('click', () => this._hideHint());
  }

  // ── Movement helpers ───────────────────────────────────────

  getTile(x, y) {
    if (x < 0 || y < 0 || x >= this.mapW || y >= this.mapH) return T.WALL;
    return this.map[y][x];
  }

  setTile(x, y, tile) {
    if (x >= 0 && y >= 0 && x < this.mapW && y < this.mapH) {
      this.map[y][x] = tile;
    }
  }

  entityAt(x, y, excludePlayer = false) {
    for (const ent of this.entities) {
      if (!ent.alive) continue;
      if (excludePlayer && ent.type === E.PLAYER) continue;
      if (ent.x === x && ent.y === y) return ent;
    }
    return null;
  }

  // Can an enemy move to (nx, ny)?
  canEnemyMove(type, nx, ny) {
    if (nx < 0 || ny < 0 || nx >= this.mapW || ny >= this.mapH) return false;
    const tile = this.getTile(nx, ny);
    // Enemies can't walk through walls, dirt, clone machines, toggle-closed
    if (ENEMY_BLOCKED_TILES.has(tile)) return false;
    // Doors block enemies
    if (DOOR_TILES.has(tile)) return false;
    // Bombs kill enemies... or block them depending on type
    if (tile === T.BOMB) return false;
    // Glider can cross water; others cannot
    if (tile === T.WATER && type !== E.GLIDER) return false;
    // Fire blocks enemies unless fireball
    if (tile === T.FIRE && type !== E.FIREBALL) return false;
    // Another entity blocking?
    const other = this.entityAt(nx, ny, false);
    if (other && other.alive && other.type !== E.PLAYER && other.type !== E.BLOCK) return false;
    return true;
  }

  // Can the player move to (nx, ny) given inventory?
  canPlayerMove(nx, ny) {
    if (nx < 0 || ny < 0 || nx >= this.mapW || ny >= this.mapH) return false;
    const tile = this.getTile(nx, ny);
    if (tile === T.WALL) return false;
    if (tile === T.TOGGLE_CLOSED) return false;
    if (tile === T.WATER   && !this.inventory.boots.has(T.FLIPPERS))    return false;
    if (tile === T.FIRE    && !this.inventory.boots.has(T.FIRE_BOOTS))  return false;
    if (DOOR_TILES.has(tile)) {
      const keyNeeded = KEY_FOR_DOOR[tile];
      if (!this.inventory.keys[keyNeeded] || this.inventory.keys[keyNeeded] === 0) return false;
    }
    // Check for pushable block
    const ent = this.entityAt(nx, ny, true);
    if (ent && ent.type === E.BLOCK) {
      // Try to push block
      return this._canPushBlock(ent, nx - this.player.x, ny - this.player.y);
    }
    return true;
  }

  _canPushBlock(block, dx, dy) {
    const bx = block.x + dx;
    const by = block.y + dy;
    if (bx < 0 || by < 0 || bx >= this.mapW || by >= this.mapH) return false;
    const tile = this.getTile(bx, by);
    if (tile === T.WALL || tile === T.TOGGLE_CLOSED) return false;
    if (DOOR_TILES.has(tile)) return false;
    if (this.entityAt(bx, by, true)) return false;
    return true;
  }

  // ── Player step ───────────────────────────────────────────

  _stepPlayer(dir) {
    const nx = this.player.x + DX[dir];
    const ny = this.player.y + DY[dir];
    this.player.dir = dir;

    if (!this.canPlayerMove(nx, ny)) {
      this.audio.bump();
      return false;
    }

    // Push block if present
    const blockEnt = this.entityAt(nx, ny, true);
    if (blockEnt && blockEnt.type === E.BLOCK) {
      const bx = blockEnt.x + DX[dir];
      const by = blockEnt.y + DY[dir];
      blockEnt.x = bx;
      blockEnt.y = by;
      // Block landing on water → become gravel; remove the block entity
      if (this.getTile(bx, by) === T.WATER) {
        this.setTile(bx, by, T.GRAVEL);
        blockEnt.alive = false;
      }
    }

    this.player.x = nx;
    this.player.y = ny;

    // Check if the player walked into an enemy's current position
    for (const ent of this.entities) {
      if (ent.alive && ent.type !== E.PLAYER && ent.type !== E.BLOCK) {
        if (ent.x === nx && ent.y === ny) {
          this._killPlayer('Chip was caught by an enemy!');
          return true;
        }
      }
    }

    this._handleTile(nx, ny);
    return true;
  }

  _handleTile(x, y) {
    const tile = this.getTile(x, y);

    if (tile === T.CHIP) {
      this.setTile(x, y, T.FLOOR);
      this.chipsLeft--;
      document.getElementById('hud-chips').textContent = this.chipsLeft;
      this.audio.collectChip();
      return;
    }

    if (tile === T.EXIT) {
      if (this.chipsLeft === 0) {
        this.won = true;
        this.audio.levelComplete();
      }
      return;
    }

    if (tile === T.WATER && !this.inventory.boots.has(T.FLIPPERS)) {
      this._killPlayer('Chip drowned!');
      return;
    }

    if (tile === T.FIRE && !this.inventory.boots.has(T.FIRE_BOOTS)) {
      this._killPlayer('Chip burned up!');
      return;
    }

    if (tile === T.BOMB) {
      this.setTile(x, y, T.FLOOR);
      this._killPlayer('Chip hit a bomb!');
      return;
    }

    if (tile === T.THIEF) {
      this.inventory.boots.clear();
      this._refreshInventoryHUD();
      return;
    }

    if (KEY_TILES.has(tile)) {
      this.inventory.keys[tile]++;
      this.setTile(x, y, T.FLOOR);
      this.audio.pickupItem();
      this._refreshInventoryHUD();
      return;
    }

    if (DOOR_TILES.has(tile)) {
      const key = KEY_FOR_DOOR[tile];
      if (!REUSABLE_KEYS.has(key)) {
        this.inventory.keys[key]--;
      }
      this.setTile(x, y, T.FLOOR);
      this.audio.openDoor();
      this._refreshInventoryHUD();
      return;
    }

    if (BOOT_TILES.has(tile)) {
      this.inventory.boots.add(tile);
      this.setTile(x, y, T.FLOOR);
      this.audio.pickupItem();
      this._refreshInventoryHUD();
      return;
    }

    if (tile === T.HINT) {
      this._showHint();
      return;
    }

    if (tile === T.DIRT) {
      this.setTile(x, y, T.FLOOR);
      return;
    }

    if (tile === T.GREEN_BUTTON) {
      this._toggleToggleWalls();
      return;
    }

    if (tile === T.BLUE_BUTTON) {
      this._reverseTanks();
      return;
    }

    if (tile === T.TELEPORT) {
      this._teleportPlayer(x, y);
      return;
    }

    if (FORCE_TILES.has(tile) && !this.inventory.boots.has(T.SUCTION_BOOTS)) {
      this._applyForce(tile);
      return;
    }

    if (ICE_TILES.has(tile) && !this.inventory.boots.has(T.ICE_SKATES)) {
      this._applyIce(tile);
    }
  }

  _applyForce(tile) {
    const dir = FORCE_DIR[tile];
    const nx  = this.player.x + DX[dir];
    const ny  = this.player.y + DY[dir];
    if (this.canPlayerMove(nx, ny)) {
      this.player.x = nx;
      this.player.y = ny;
      this._handleTile(nx, ny);
    }
  }

  _applyIce(tile) {
    let dir = this.player.dir;
    // Corner redirect
    if (ICE_CORNER_REDIRECT[tile] && ICE_CORNER_REDIRECT[tile][dir] !== undefined) {
      dir = ICE_CORNER_REDIRECT[tile][dir];
      this.player.dir = dir;
    }
    const nx = this.player.x + DX[dir];
    const ny = this.player.y + DY[dir];
    if (this.canPlayerMove(nx, ny)) {
      this.player.x = nx;
      this.player.y = ny;
      this._handleTile(nx, ny);
    }
  }

  _teleportPlayer(fromX, fromY) {
    if (this.teleports.length < 2) return;
    const idx = this.teleports.findIndex(t => t.x === fromX && t.y === fromY);
    if (idx === -1) return;
    const dest = this.teleports[(idx + 1) % this.teleports.length];
    this.player.x = dest.x;
    this.player.y = dest.y;
  }

  _toggleToggleWalls() {
    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        if (this.map[y][x] === T.TOGGLE_CLOSED) this.map[y][x] = T.TOGGLE_OPEN;
        else if (this.map[y][x] === T.TOGGLE_OPEN) this.map[y][x] = T.TOGGLE_CLOSED;
      }
    }
  }

  _reverseTanks() {
    for (const ent of this.entities) {
      if (ent.type === E.TANK) ent.dir = OPPOSITE[ent.dir];
    }
  }

  _killPlayer(msg) {
    this.dead     = true;
    this.deathMsg = msg;
    this.audio.death();
  }

  // ── Enemy AI ──────────────────────────────────────────────

  _stepEnemies() {
    for (const ent of this.entities) {
      if (!ent.alive || ent.type === E.PLAYER || ent.type === E.BLOCK) continue;

      // Teeth moves every other tick
      if (ent.type === E.TEETH) {
        ent.skipTick = !ent.skipTick;
        if (ent.skipTick) continue;
      }

      const moved = this._moveEnemy(ent);

      // Kill player if enemy lands on them
      if (ent.x === this.player.x && ent.y === this.player.y) {
        this._killPlayer('Chip was caught by an enemy!');
      }
    }
  }

  _moveEnemy(ent) {
    switch (ent.type) {
      case E.BUG:        return this._wallFollower(ent, true);   // left-wall
      case E.FIREBALL:   return this._wallFollower(ent, false);  // right-wall
      case E.BALL:       return this._bouncer(ent);
      case E.TANK:       return this._tanker(ent);
      case E.GLIDER:     return this._glider(ent);
      case E.TEETH:      return this._chaser(ent);
      case E.WALKER:     return this._walker(ent);
      default:           return false;
    }
  }

  _wallFollower(ent, leftWall) {
    // Try: turn toward wall side, go straight, turn away, reverse
    const turn1 = leftWall ? LEFT_OF[ent.dir]     : RIGHT_OF[ent.dir];
    const turn2 = ent.dir;
    const turn3 = leftWall ? RIGHT_OF[ent.dir]    : LEFT_OF[ent.dir];
    const turn4 = OPPOSITE[ent.dir];

    for (const newDir of [turn1, turn2, turn3, turn4]) {
      const nx = ent.x + DX[newDir];
      const ny = ent.y + DY[newDir];
      if (this.canEnemyMove(ent.type, nx, ny)) {
        ent.dir = newDir;
        ent.x   = nx;
        ent.y   = ny;
        return true;
      }
    }
    return false;
  }

  _bouncer(ent) {
    const nx = ent.x + DX[ent.dir];
    const ny = ent.y + DY[ent.dir];
    if (this.canEnemyMove(ent.type, nx, ny)) {
      ent.x = nx;
      ent.y = ny;
    } else {
      ent.dir = OPPOSITE[ent.dir];
      const bx = ent.x + DX[ent.dir];
      const by = ent.y + DY[ent.dir];
      if (this.canEnemyMove(ent.type, bx, by)) {
        ent.x = bx;
        ent.y = by;
      }
    }
    return true;
  }

  _tanker(ent) {
    const nx = ent.x + DX[ent.dir];
    const ny = ent.y + DY[ent.dir];
    if (this.canEnemyMove(ent.type, nx, ny)) {
      ent.x = nx;
      ent.y = ny;
      return true;
    }
    return false;
  }

  _glider(ent) {
    const nx = ent.x + DX[ent.dir];
    const ny = ent.y + DY[ent.dir];
    if (this.canEnemyMove(ent.type, nx, ny)) {
      ent.x = nx;
      ent.y = ny;
      return true;
    }
    // Try right, left, back
    for (const newDir of [RIGHT_OF[ent.dir], LEFT_OF[ent.dir], OPPOSITE[ent.dir]]) {
      const mx = ent.x + DX[newDir];
      const my = ent.y + DY[newDir];
      if (this.canEnemyMove(ent.type, mx, my)) {
        ent.dir = newDir;
        ent.x   = mx;
        ent.y   = my;
        return true;
      }
    }
    return false;
  }

  _chaser(ent) {
    const dx  = this.player.x - ent.x;
    const dy  = this.player.y - ent.y;
    const hor = Math.abs(dx) > Math.abs(dy);

    const dirs = [];
    if (hor) {
      dirs.push(dx > 0 ? D.E : D.W);
      dirs.push(dy > 0 ? D.S : D.N);
    } else {
      dirs.push(dy > 0 ? D.S : D.N);
      dirs.push(dx > 0 ? D.E : D.W);
    }
    // Fallback opposite dirs
    dirs.push(OPPOSITE[dirs[0]], OPPOSITE[dirs[1]]);

    for (const d of dirs) {
      const nx = ent.x + DX[d];
      const ny = ent.y + DY[d];
      if (this.canEnemyMove(ent.type, nx, ny)) {
        ent.dir = d;
        ent.x   = nx;
        ent.y   = ny;
        return true;
      }
    }
    return false;
  }

  _walker(ent) {
    const dirs = [D.N, D.E, D.S, D.W];
    // shuffle
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const d of dirs) {
      const nx = ent.x + DX[d];
      const ny = ent.y + DY[d];
      if (this.canEnemyMove(ent.type, nx, ny)) {
        ent.dir = d;
        ent.x   = nx;
        ent.y   = ny;
        return true;
      }
    }
    return false;
  }

  // ── Hint ──────────────────────────────────────────────────

  _showHint() {
    const banner  = document.getElementById('hint-banner');
    const textEl  = document.getElementById('hint-text');
    textEl.textContent = LEVELS[this.currentLevel].hint;
    banner.classList.remove('hidden');
  }

  _hideHint() {
    document.getElementById('hint-banner').classList.add('hidden');
  }

  // ── Game Loop ─────────────────────────────────────────────

  _tick(ts) {
    if (!this.running) return;

    if (this.lastTick === null) this.lastTick = ts;
    const dt = Math.min(ts - this.lastTick, 100); // cap at 100ms
    this.lastTick = ts;

    if (!this.dead && !this.won) {
      // Timer
      if (this.timeLimit > 0) {
        this.timeElapsed += dt / 1000;
        const remaining = Math.max(0, Math.ceil(this.timeLimit - this.timeElapsed));
        document.getElementById('hud-time').textContent = remaining;
        if (remaining === 0) {
          this._showScreen('timeout-screen');
          this.running = false;
          return;
        }
      }

      // Player movement: process queued key or held key
      const now    = ts;
      let moveDir  = null;
      if (this.queuedDir !== null) {
        moveDir       = this.queuedDir;
        this.queuedDir = null;
        this.lastMove  = now;
      } else if (this.keysHeld.size > 0 && now - this.lastMove >= this.moveDelay) {
        // Prefer the last held direction
        moveDir      = [...this.keysHeld][this.keysHeld.size - 1];
        this.lastMove = now;
      }

      if (moveDir !== null) {
        // In 3D mode ↑↓ move forward/back; ←→ turn the player.
        // In 2D mode all four directions move directly.
        let moved = false;
        if (this.gameMode === '3d') {
          if      (moveDir === D.N) { moved = this._stepPlayer(this.player.dir); }
          else if (moveDir === D.S) { moved = this._stepPlayer(OPPOSITE[this.player.dir]); }
          else if (moveDir === D.W) { this.player.dir = LEFT_OF[this.player.dir]; }
          else if (moveDir === D.E) { this.player.dir = RIGHT_OF[this.player.dir]; }
        } else {
          moved = this._stepPlayer(moveDir);
        }
        if (moved && !this.dead && !this.won) {
          this._stepEnemies();
          // Check if enemy landed on player after move
          for (const ent of this.entities) {
            if (ent.alive && ent.type !== E.PLAYER && ent.type !== E.BLOCK) {
              if (ent.x === this.player.x && ent.y === this.player.y) {
                this._killPlayer('Chip was caught by an enemy!');
                break;
              }
            }
          }
        }
      }
    }

    // Handle death / win
    if (this.dead && !this._deathHandled) {
      this._deathHandled = true;
      setTimeout(() => {
        document.getElementById('death-msg').textContent = this.deathMsg;
        this._showScreen('death-screen');
      }, 600);
    }

    if (this.won && !this._winHandled) {
      this._winHandled = true;
      const isLast = this.currentLevel >= LEVELS.length - 1;
      setTimeout(() => {
        if (isLast) {
          this._showScreen('complete-screen');
        } else {
          document.getElementById('win-msg').textContent =
            `Level ${LEVELS[this.currentLevel].number} complete!`;
          this._showScreen('win-screen');
        }
      }, 400);
    }

    this.renderer.draw(this);
    this.rafId = requestAnimationFrame(ts => this._tick(ts));
  }

  // ── Screens ───────────────────────────────────────────────

  _showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  start() {
    const canvas = document.getElementById('game-canvas');

    // Shared helper: begin playing in the given mode from level 0.
    const _startGame = (mode) => {
      this.gameMode  = mode;
      this.renderer  = mode === '3d' ? new Renderer3D(canvas) : new Renderer(canvas);
      this.audio._resume();
      this.currentLevel  = 0;
      this._deathHandled = false;
      this._winHandled   = false;
      this.loadLevel(0);
      this._showScreen('game-screen');
      this.running  = true;
      this.lastTick = null;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(ts => this._tick(ts));
    };

    // Mode-select buttons on the title screen.
    document.getElementById('start-2d-btn').addEventListener('click', () => _startGame('2d'));
    document.getElementById('start-3d-btn').addEventListener('click', () => _startGame('3d'));

    document.getElementById('next-level-btn').addEventListener('click', () => {
      this.currentLevel++;
      this._deathHandled = false;
      this._winHandled   = false;
      this.loadLevel(this.currentLevel);
      this._showScreen('game-screen');
      this.running  = true;
      this.lastTick = null;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(ts => this._tick(ts));
    });

    document.getElementById('retry-btn').addEventListener('click', () => this._retryLevel());
    document.getElementById('timeout-retry-btn').addEventListener('click', () => this._retryLevel());

    // "Play Again" returns to the title screen so the player can re-choose mode.
    document.getElementById('play-again-btn').addEventListener('click', () => {
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
      this.running = false;
      this._showScreen('title-screen');
    });
  }

  _retryLevel() {
    this._deathHandled = false;
    this._winHandled   = false;
    this.loadLevel(this.currentLevel);
    this._showScreen('game-screen');
    this.running  = true;
    this.lastTick = null;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(ts => this._tick(ts));
  }
}

// ============================================================
//  BOOT
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.start();
});
