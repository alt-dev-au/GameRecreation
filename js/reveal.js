'use strict';

// ============================================================
//  THE REVEAL — a special surprise game mode
//
//  Shmo (the Big Brother) journeys through three nursery-themed
//  stages collecting baby bottles.  Beat the final stage, pop the
//  mystery balloon, and discover the big family secret!
//
//  Loaded after game.js (uses T, E, D, _copyMap, Renderer, KEY_COLORS,
//  DOOR_COLORS) and is referenced by Game when mode === 'reveal'.
// ============================================================

// ────────────────────────────────────────────────────────────
//  STAGE MAPS  (16×16, same tile IDs as the main game)
// ────────────────────────────────────────────────────────────

// ── STAGE 1: Welcome to the Nursery ─────────────────────────
// Two cosy nursery rooms joined by corridors.  6 bottles, no
// runaway toys yet, no time limit.  Hint tile right next to the
// start so the player learns the goal.
const _R1_MAP = [
  //col: 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
  /*r0*/  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  /*r1*/  [1, 0,23, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // hint @ (2,1)
  /*r2*/  [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1],  // gap @ c3 & c12
  /*r3*/  [1, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 1, 1, 1],  // bottles @ (4,3) (11,3)
  /*r4*/  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],  // upper nursery
  /*r5*/  [1, 1, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 1, 1],  // bottle @ (7,5)
  /*r6*/  [1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1],  // gap @ c7 & c8
  /*r7*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // hallway
  /*r8*/  [1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1],  // gap @ c7 & c8
  /*r9*/  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],  // lower nursery
  /*r10*/ [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  /*r11*/ [1, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 1, 1, 1],  // bottles @ (4,11)(11,11)
  /*r12*/ [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1],  // gap @ c3 & c12
  /*r13*/ [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // bottom hallway
  /*r14*/ [1, 0, 0, 2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 1],  // bottle(3,14) gift box(8,14)
  /*r15*/ [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
// bottles: (4,3)(11,3)(7,5)(4,11)(11,11)(3,14) = 6   gift box: (8,14)

// ── STAGE 2: Runaway Toys! ──────────────────────────────────
// Same nursery layout, but the toys have escaped the toy box:
// a wind-up teddy patrols the upper room, a rubber ducky bounces
// along the hallway, and a toy train circles the lower room.
const _R2_MAP = [
  /*r0*/  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  /*r1*/  [1, 0,23, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // hint @ (2,1)
  /*r2*/  [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1],
  /*r3*/  [1, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 1, 1, 1],  // bottles @ (4,3)(11,3)
  /*r4*/  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],  // upper playroom (teddy)
  /*r5*/  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  /*r6*/  [1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1],
  /*r7*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // hallway (ducky)
  /*r8*/  [1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1],
  /*r9*/  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],  // lower playroom (toy train)
  /*r10*/ [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  /*r11*/ [1, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 1, 1, 1],  // bottles @ (4,11)(11,11)
  /*r12*/ [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1],
  /*r13*/ [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  /*r14*/ [1, 0, 0, 2, 0, 0, 0, 0, 3, 0, 0, 0, 2, 0, 0, 1],  // bottles(3,14)(12,14) gift(8,14)
  /*r15*/ [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
// bottles: (4,3)(11,3)(4,11)(11,11)(3,14)(12,14) = 6   gift box: (8,14)

// ── STAGE 3: The Stork's Secret ─────────────────────────────
// The big finale.  A BLUE key opens the blue door; a PINK key
// opens the pink door.  You need both — pink or blue, which will
// it be?  Bouncing duckies and a crawling baby doll stand between
// Shmo and the stork's secret gift box.
const _R3_MAP = [
  /*r0*/  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  /*r1*/  [1, 0,23, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // hint @ (2,1), BLUE key @ (6,1)
  /*r2*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  /*r3*/  [1, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 1],  // bottles @ (3,3)(12,3)
  /*r4*/  [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],
  /*r5*/  [1, 1, 1, 1, 1, 1,13, 1, 1, 1, 1, 1, 1, 1, 1, 1],  // BLUE door @ (6,5)
  /*r6*/  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // ducky bounces here
  /*r7*/  [1, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 1],  // bottles @ (3,7)(12,7)
  /*r8*/  [1, 0, 1, 0, 1, 0, 0,10, 0, 0, 0, 1, 0, 1, 0, 1],  // PINK key @ (7,8)
  /*r9*/  [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],  // teddy patrols here
  /*r10*/ [1, 1, 1, 1, 1, 1,14, 1, 1, 1, 1, 1, 1, 1, 1, 1],  // PINK door @ (6,10)
  /*r11*/ [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],  // ducky bounces here
  /*r12*/ [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  /*r13*/ [1, 0, 1, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 1, 0, 1],  // STORK'S GIFT @ (7,13)
  /*r14*/ [1, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1],  // bottles @ (5,14)(9,14)
  /*r15*/ [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
// bottles: (3,3)(12,3)(3,7)(12,7)(5,14)(9,14) = 6   gift box: (7,13)

// ── Assemble the reveal level set ───────────────────────────

const REVEAL_LEVELS = [
  {
    number: 1,
    title:  'Welcome to the Nursery',
    hint:   'Welcome to the Nursery, Big Brother!  Collect every baby bottle 🍼 then open the mystery gift box 🎁!',
    timeLimit: 0,
    map:    _copyMap(_R1_MAP),
    playerStart: { x: 1, y: 1 },
    entities: [],
    width:  16,
    height: 16,
  },
  {
    number: 2,
    title:  'Runaway Toys!',
    hint:   'Uh-oh — the toys escaped the toy box!  Dodge the teddy 🧸, the ducky 🦆 and the toy train 🚂 while you grab the bottles!',
    timeLimit: 0,
    map:    _copyMap(_R2_MAP),
    playerStart: { x: 1, y: 1 },
    entities: [
      { type: E.BUG,      x: 7, y: 4,  dir: D.N },  // wind-up teddy — upper playroom
      { type: E.BALL,     x: 7, y: 7,  dir: D.E },  // bouncing ducky — hallway
      { type: E.FIREBALL, x: 7, y: 10, dir: D.S },  // toy train — lower playroom
    ],
    width:  16,
    height: 16,
  },
  {
    number: 3,
    title:  "The Stork's Secret",
    hint:   'Pink or blue?  Grab BOTH keys to unlock the doors and reach the stork’s secret gift box... the answer is inside!',
    timeLimit: 0,
    map:    _copyMap(_R3_MAP),
    playerStart: { x: 1, y: 1 },
    entities: [
      { type: E.BALL, x: 8, y: 6,  dir: D.E },  // bouncing ducky — middle hallway
      { type: E.BUG,  x: 8, y: 9,  dir: D.E },  // wind-up teddy — middle chamber
      { type: E.BALL, x: 9, y: 11, dir: D.W },  // bouncing ducky — bottom hallway
    ],
    width:  16,
    height: 16,
  },
];

// ────────────────────────────────────────────────────────────
//  REVEAL RENDERER — pastel nursery theme
// ────────────────────────────────────────────────────────────

const REVEAL_COLORS = {
  floorPink:  '#ffeef5',   // soft blush
  floorBlue:  '#eaf4ff',   // soft sky
  blockPink:  '#ffb6d9',   // pink baby block
  blockPinkD: '#e08ab4',   // pink block shadow
  blockBlue:  '#a8d4ff',   // blue baby block
  blockBlueD: '#7fadde',   // blue block shadow
  bottleRing: '#ff8fb3',   // bottle glow ring
  giftOpen:   '#ff9ec4',   // unwrappable gift box
  giftLocked: '#b8b0c0',   // still-wrapped (locked) gift box
  ribbonGold: '#ffd700',
  ribbonGrey: '#8a8494',
};

// Toy stand-ins for the regular enemies
const REVEAL_ENEMY_EMOJI = {
  [E.BUG]:      '🧸',  // wind-up teddy
  [E.FIREBALL]: '🚂',  // toy train
  [E.BALL]:     '🦆',  // rubber ducky
  [E.TANK]:     '🚗',  // toy car
  [E.GLIDER]:   '🪁',  // kite
  [E.TEETH]:    '👶',  // crawling baby doll
  [E.WALKER]:   '🎁',  // mystery present
};

// Letters scattered across the wall blocks
const REVEAL_BLOCK_LETTERS = 'BABY?';

class RendererReveal extends Renderer {
  constructor(canvas) {
    super(canvas);
    // Pink key/door instead of red — pink or blue, which will it be?
    this.keyColors  = { ...KEY_COLORS,  [T.KEY_RED]:  '#ff69b4' };
    this.doorColors = { ...DOOR_COLORS, [T.DOOR_RED]: '#ff69b4' };
    this._mapX = 0;
    this._mapY = 0;
  }

  // Stash map coordinates so floor/wall patterns stay fixed to the
  // map instead of shifting with the camera.
  _drawTile(ctx, tile, sx, sy, chipsLeft, mx, my, game) {
    this._mapX = mx;
    this._mapY = my;
    super._drawTile(ctx, tile, sx, sy, chipsLeft, mx, my, game);
  }

  // Soft pink/blue checkerboard floor — the big question underfoot!
  _drawFloor(ctx, sx, sy) {
    const ts = this.ts;
    const pink = (this._mapX + this._mapY) % 2 === 0;
    ctx.fillStyle = pink ? REVEAL_COLORS.floorPink : REVEAL_COLORS.floorBlue;
    ctx.fillRect(sx, sy, ts, ts);
    ctx.strokeStyle = 'rgba(180,150,180,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, ts - 1, ts - 1);
  }

  // Walls are pastel alphabet baby blocks spelling B-A-B-Y
  _drawWall(ctx, sx, sy) {
    const ts = this.ts;
    const mx = this._mapX, my = this._mapY;
    const pink = (mx + my) % 2 === 0;
    const base   = pink ? REVEAL_COLORS.blockPink  : REVEAL_COLORS.blockBlue;
    const shadow = pink ? REVEAL_COLORS.blockPinkD : REVEAL_COLORS.blockBlueD;
    // Block body
    ctx.fillStyle = base;
    ctx.fillRect(sx, sy, ts, ts);
    // Bevel — light top/left, dark bottom/right
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(sx, sy, ts, 4);
    ctx.fillRect(sx, sy, 4, ts);
    ctx.fillStyle = shadow;
    ctx.fillRect(sx, sy + ts - 4, ts, 4);
    ctx.fillRect(sx + ts - 4, sy, 4, ts);
    // Inner frame
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 7, sy + 7, ts - 14, ts - 14);
    // Letter
    const letter = REVEAL_BLOCK_LETTERS[(mx * 3 + my * 7) % REVEAL_BLOCK_LETTERS.length];
    ctx.fillStyle = shadow;
    ctx.font = `bold ${ts - 18}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, sx + ts / 2, sy + ts / 2 + 1);
  }

  // Chips become baby bottles
  _drawChip(ctx, sx, sy) {
    const ts = this.ts;
    const cx = sx + ts / 2, cy = sy + ts / 2;
    // Soft glow pad
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(cx, cy, ts / 2 - 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = REVEAL_COLORS.bottleRing;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, ts / 2 - 5, 0, Math.PI * 2);
    ctx.stroke();
    // Bottle
    ctx.font = `${ts - 14}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍼', cx, cy + 1);
  }

  // The exit is the stork's mystery gift box
  _drawExit(ctx, sx, sy, open) {
    const ts = this.ts;
    const box    = open ? REVEAL_COLORS.giftOpen   : REVEAL_COLORS.giftLocked;
    const ribbon = open ? REVEAL_COLORS.ribbonGold : REVEAL_COLORS.ribbonGrey;
    // Box body
    ctx.fillStyle = box;
    ctx.fillRect(sx + 4, sy + 12, ts - 8, ts - 16);
    // Lid
    ctx.fillRect(sx + 2, sy + 6, ts - 4, 8);
    // Vertical ribbon
    ctx.fillStyle = ribbon;
    ctx.fillRect(sx + ts / 2 - 3, sy + 6, 6, ts - 10);
    // Horizontal ribbon
    ctx.fillRect(sx + 4, sy + ts / 2 + 2, ts - 8, 5);
    // Bow on top
    ctx.font = `${Math.floor(ts / 2.5)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎀', sx + ts / 2, sy + 7);
    // Question mark
    ctx.fillStyle = open ? '#ffffff' : '#6a6474';
    ctx.font = `bold ${Math.floor(ts / 2)}px 'Courier New', monospace`;
    ctx.fillText('?', sx + ts / 2, sy + ts * 0.68);
  }

  // Runaway toys instead of enemies
  _drawEnemy(ctx, ent, sx, sy) {
    const ts = this.ts;
    // Soft shadow under the toy
    ctx.fillStyle = 'rgba(120,80,120,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx + ts / 2, sy + ts - 6, ts / 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // The toy itself
    ctx.font = `${ts - 8}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(REVEAL_ENEMY_EMOJI[ent.type] || '🎁', sx + ts / 2, sy + ts / 2);
  }
}

// ────────────────────────────────────────────────────────────
//  CONFETTI — canvas particle shower for the big moment
// ────────────────────────────────────────────────────────────

class ConfettiShow {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.rafId  = null;
    this.particles = [];
    this.colors = ['#ff69b4', '#ffb6d9', '#ff8fab', '#ff1493', '#ffd700', '#ffffff', '#ffc0cb'];
    this.emoji  = ['💖', '🎀', '👶', '🍼', '💕'];
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _spawn(burst) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    for (let i = 0; i < 160; i++) {
      this.particles.push({
        x:    Math.random() * w,
        y:    burst ? h / 2 + (Math.random() - 0.5) * 200 : -Math.random() * h,
        vx:   (Math.random() - 0.5) * (burst ? 14 : 2),
        vy:   burst ? (Math.random() - 0.9) * 12 : 2 + Math.random() * 3,
        rot:  Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.25,
        size: 6 + Math.random() * 10,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        emoji: Math.random() < 0.18
          ? this.emoji[Math.floor(Math.random() * this.emoji.length)]
          : null,
      });
    }
  }

  start() {
    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    this.particles = [];
    this._spawn(true);    // initial burst from the centre (the balloon pop!)
    this._spawn(false);   // plus a steady rain from above
    const loop = () => {
      this._step();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  _step() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    for (const p of this.particles) {
      p.vy  += 0.12;                       // gravity
      p.vy   = Math.min(p.vy, 5);          // terminal velocity
      p.vx  *= 0.99;
      p.x   += p.vx + Math.sin(p.y / 40);  // gentle sway
      p.y   += p.vy;
      p.rot += p.vrot;
      // Recycle particles that fall off the bottom
      if (p.y > h + 30) {
        p.y  = -20;
        p.x  = Math.random() * w;
        p.vy = 2 + Math.random() * 3;
        p.vx = (Math.random() - 0.5) * 2;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.emoji) {
        ctx.font = `${p.size + 8}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    window.removeEventListener('resize', this._onResize);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = [];
  }
}

// ────────────────────────────────────────────────────────────
//  THE BIG MOMENT — countdown → balloon pop → the reveal!
// ────────────────────────────────────────────────────────────

const BALLOON_TAPS_TO_POP = 5;

// Tears down the in-flight celebration (pending timers, listeners, confetti)
// so a new one can start clean.  Set by startRevealCelebration.
let _celebrationCleanup = null;

function startRevealCelebration(game) {
  // The celebration runs its own animations — halt the game loop so it
  // stops drawing the (now hidden) game screen every frame.
  game.running = false;
  if (game.rafId) { cancelAnimationFrame(game.rafId); game.rafId = null; }

  // If a previous celebration is somehow still in flight, tear it down first.
  if (_celebrationCleanup) _celebrationCleanup();

  const show = id => {
    document.querySelectorAll('#reveal-screen .reveal-phase').forEach(el => el.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
  };

  const balloon     = document.getElementById('reveal-balloon');
  const homeBtn     = document.getElementById('reveal-home-btn');
  const countdownEl = document.getElementById('reveal-countdown');
  const timers      = [];

  const cleanup = () => {
    timers.forEach(clearTimeout);
    balloon.removeEventListener('pointerdown', onTap);
    homeBtn.removeEventListener('click', onHome);
    if (game._confetti) { game._confetti.stop(); game._confetti = null; }
    _celebrationCleanup = null;
  };
  _celebrationCleanup = cleanup;

  game._showScreen('reveal-screen');
  show('reveal-intro');
  countdownEl.textContent = '';

  // Phase 1 — countdown: 3... 2... 1...
  let count = 3;
  const tickCountdown = () => {
    if (count > 0) {
      countdownEl.textContent = count;
      // Restart the pop-in animation
      countdownEl.classList.remove('count-pop');
      void countdownEl.offsetWidth;
      countdownEl.classList.add('count-pop');
      game.audio.countdownBeep();
      count--;
      timers.push(setTimeout(tickCountdown, 1000));
    } else {
      startBalloonPhase();
    }
  };
  timers.push(setTimeout(tickCountdown, 1600));

  // Phase 2 — inflate the mystery balloon by tapping it
  let taps = 0;
  let popped = false;

  const onTap = (e) => {
    e.preventDefault();
    if (popped) return;
    taps++;
    game.audio.balloonTap(taps);
    balloon.style.transform = `scale(${1 + taps * 0.22})`;
    if (taps >= BALLOON_TAPS_TO_POP) {
      popped = true;
      popBalloon();
    }
  };

  // "Back to title" — tear everything down and hand control back to the game.
  const onHome = () => {
    cleanup();
    game._returnToTitle();
  };
  homeBtn.addEventListener('click', onHome);

  function startBalloonPhase() {
    taps = 0;
    popped = false;
    balloon.style.transform = 'scale(1)';
    balloon.classList.remove('popped');
    show('reveal-balloon-phase');
    balloon.addEventListener('pointerdown', onTap);
  }

  // Phase 3 — POP!  Confetti + the big secret
  function popBalloon() {
    balloon.removeEventListener('pointerdown', onTap);
    game.audio.balloonPop();
    balloon.classList.add('popped');
    timers.push(setTimeout(() => {
      show('reveal-final-phase');
      game.audio.revealFanfare();
      // Pink confetti everywhere!
      game._confetti = new ConfettiShow(document.getElementById('confetti-canvas'));
      game._confetti.start();
    }, 450));
  }
}
