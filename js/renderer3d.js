'use strict';

/* ============================================================
   3-D Renderer  (DDA raycasting – Wolfenstein/Doom-style)

   Uses the same tile constants (T.*), entity constants (E.*),
   direction constants (D.*) and colour maps defined in game.js,
   so this file must be loaded AFTER game.js.
   ============================================================ */

class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.W      = VIEW_W * TILE_SIZE;
    this.H      = VIEW_H * TILE_SIZE;
    this.canvas.width  = this.W;
    this.canvas.height = this.H;

    // Camera-plane half-width.  tan(33°) ≈ 0.649 → ~66° horizontal FOV.
    this.PLANE = 0.66;

    // Per-column depth buffer (used for sprite occlusion).
    this.zBuf = new Float64Array(this.W);

    // direction → [dirX, dirY, planeX, planeY]
    // The camera plane always points "right" relative to the facing direction.
    this._dv = {
      [D.N]: [  0, -1,  this.PLANE,  0           ],
      [D.E]: [  1,  0,  0,           this.PLANE   ],
      [D.S]: [  0,  1, -this.PLANE,  0           ],
      [D.W]: [ -1,  0,  0,          -this.PLANE  ],
    };

    // Sprite lookup tables – built once, reused every frame.
    this._enemySyms = {
      [E.BLOCK]: '■', [E.BUG]: '🐛', [E.FIREBALL]: '🔥',
      [E.BALL]:  '●', [E.TANK]: '⊞', [E.GLIDER]:   '▲',
      [E.TEETH]: '👾',[E.WALKER]: '?',
    };
    this._tileSprites = {
      [T.CHIP]:          { color: '#ffd700', sym: '★' },
      [T.EXIT]:          { color: '#00dd66', sym: '⊞' },
      [T.KEY_BLUE]:      { color: '#2244ff', sym: 'K' },
      [T.KEY_RED]:       { color: '#ee2222', sym: 'K' },
      [T.KEY_YELLOW]:    { color: '#ffdd00', sym: 'K' },
      [T.KEY_GREEN]:     { color: '#22cc22', sym: 'K' },
      [T.FLIPPERS]:      { color: '#2266ff', sym: '💧' },
      [T.FIRE_BOOTS]:    { color: '#ff6600', sym: '🔥' },
      [T.ICE_SKATES]:    { color: '#aaddff', sym: '❄'  },
      [T.SUCTION_BOOTS]: { color: '#888888', sym: 'S'  },
      [T.BOMB]:          { color: '#333333', sym: '💣' },
      [T.THIEF]:         { color: '#660066', sym: '👤' },
      [T.HINT]:          { color: '#aaaa00', sym: '?'  },
      [T.TELEPORT]:      { color: '#9933ff', sym: '✦'  },
    };

    // Pre-allocate the floor ImageData buffer – reused every frame to avoid
    // repeated GC pressure from createImageData inside the render loop.
    const half = this.H >> 1;
    this._floorBuf = this.ctx.createImageData(this.W, half);

    // Minimap direction arrow vectors – built once.
    this._arrowDirs = {
      [D.N]: [0, -1], [D.E]: [1, 0], [D.S]: [0, 1], [D.W]: [-1, 0],
    };
  }

  /* ── Public draw entry-point ─────────────────────────────── */

  draw(game) {
    const posX = game.player.x + 0.5;
    const posY = game.player.y + 0.5;
    const [dX, dY, pX, pY] = this._dv[game.player.dir] || this._dv[D.S];

    this._drawFloor(game, posX, posY, dX, dY, pX, pY);
    this._castWalls(game, posX, posY, dX, dY, pX, pY);
    this._drawSprites(game, posX, posY, dX, dY, pX, pY);
    this._drawMinimap(game);
    this._drawOverlay(game);
  }

  /* ── Ceiling & Floor ─────────────────────────────────────── */

  _drawFloor(game, posX, posY, dX, dY, pX, pY) {
    const ctx  = this.ctx;
    const { W, H } = this;
    const half = H >> 1;

    // Ceiling: simple dark gradient (fast).
    const cg = ctx.createLinearGradient(0, 0, 0, half);
    cg.addColorStop(0, '#07070f');
    cg.addColorStop(1, '#121225');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, half);

    // Floor: per-pixel tile-colour floor casting.
    // Reuse the pre-allocated ImageData buffer (avoids per-frame GC pressure).
    const buf = this._floorBuf;
    const d   = buf.data;

    for (let row = 1; row <= half; row++) {
      // rowDist: world-space distance from camera to this floor row.
      const rowDist = half / row;
      const fog     = Math.min(0.92, rowDist * 0.13);

      // World coordinates of the leftmost floor pixel in this row.
      const fx0 = posX + rowDist * (dX - pX);
      const fy0 = posY + rowDist * (dY - pY);

      // Step per screen-column.
      const fxS = rowDist * 2 * pX / W;
      const fyS = rowDist * 2 * pY / W;

      // row=1 is just below the horizon (far away), row=half is at the screen
      // bottom (close to the camera).  In the imagedata the first row (y=0)
      // maps to screen y=half (the horizon), so row-1 gives the correct index.
      const bufRow = row - 1;

      for (let x = 0; x < W; x++) {
        const cx   = Math.floor(fx0 + fxS * x);
        const cy   = Math.floor(fy0 + fyS * x);
        const tile = game.getTile(cx, cy);

        let r, g, b;
        switch (tile) {
          case T.WATER:                                           r=10;  g=55;  b=160; break;
          case T.FIRE:                                            r=160; g=55;  b=0;   break;
          case T.ICE: case T.ICE_NE: case T.ICE_NW:
          case T.ICE_SE: case T.ICE_SW:                          r=150; g=200; b=230; break;
          case T.EXIT:                                            r=0;   g=155; b=85;  break;
          case T.DIRT:                                            r=110; g=78;  b=48;  break;
          case T.GRAVEL:                                          r=90;  g=90;  b=90;  break;
          case T.HINT:                                            r=140; g=140; b=0;   break;
          case T.TELEPORT:                                        r=110; g=40;  b=180; break;
          case T.THIEF:                                           r=80;  g=0;   b=80;  break;
          case T.FORCE_N: case T.FORCE_S:
          case T.FORCE_E: case T.FORCE_W:                        r=180; g=160; b=30;  break;
          case T.GREEN_BUTTON:                                    r=0;   g=140; b=0;   break;
          case T.BLUE_BUTTON:                                     r=0;   g=50;  b=160; break;
          case T.TOGGLE_OPEN:                                     r=160; g=90;  b=20;  break;
          default:                                                r=92;  g=74;  b=52;
        }

        r = Math.round(r * (1 - fog) + 6  * fog);
        g = Math.round(g * (1 - fog) + 6  * fog);
        b = Math.round(b * (1 - fog) + 16 * fog);

        const i = (bufRow * W + x) << 2;
        d[i]   = r;
        d[i+1] = g;
        d[i+2] = b;
        d[i+3] = 255;
      }
    }

    ctx.putImageData(buf, 0, half);
  }

  /* ── Wall raycasting (DDA) ───────────────────────────────── */

  _isSolid(tile) {
    return tile === T.WALL || DOOR_TILES.has(tile) || tile === T.TOGGLE_CLOSED;
  }

  _wallColor(tile, side) {
    // side=1 (N/S face) is rendered slightly darker for a depth cue.
    switch (tile) {
      case T.WALL:          return side ? '#3d4f5f' : '#5d7180';
      case T.DOOR_BLUE:     return side ? '#1628a0' : '#2244ee';
      case T.DOOR_RED:      return side ? '#a01010' : '#ee2222';
      case T.DOOR_YELLOW:   return side ? '#a09900' : '#ddcc00';
      case T.DOOR_GREEN:    return side ? '#0f8020' : '#22bb33';
      case T.TOGGLE_CLOSED: return side ? '#8f4d00' : '#cc6e00';
      default:              return side ? '#3a3a3a' : '#555555';
    }
  }

  _castWalls(game, posX, posY, dX, dY, pX, pY) {
    const ctx  = this.ctx;
    const { W, H } = this;

    for (let x = 0; x < W; x++) {
      const camX = 2 * x / W - 1;   // -1 (left) .. +1 (right)
      const rDX  = dX + pX * camX;
      const rDY  = dY + pY * camX;

      let mapX = Math.floor(posX);
      let mapY = Math.floor(posY);

      const ddX = Math.abs(rDX) < 1e-10 ? 1e30 : Math.abs(1 / rDX);
      const ddY = Math.abs(rDY) < 1e-10 ? 1e30 : Math.abs(1 / rDY);

      let stepX, stepY, sdX, sdY;
      if (rDX < 0) { stepX = -1; sdX = (posX - mapX)     * ddX; }
      else         { stepX =  1; sdX = (mapX + 1 - posX) * ddX; }
      if (rDY < 0) { stepY = -1; sdY = (posY - mapY)     * ddY; }
      else         { stepY =  1; sdY = (mapY + 1 - posY) * ddY; }

      let side = 0, wallTile = T.WALL;

      for (let n = 0; n < 64; n++) {
        if (sdX < sdY) { sdX += ddX; mapX += stepX; side = 0; }
        else           { sdY += ddY; mapY += stepY; side = 1; }

        if (mapX < 0 || mapX >= game.mapW || mapY < 0 || mapY >= game.mapH) {
          wallTile = T.WALL; break;
        }
        wallTile = game.getTile(mapX, mapY);
        if (this._isSolid(wallTile)) break;
      }

      // Perpendicular distance (avoids fisheye distortion).
      const perpDist = Math.max(0.05, side === 0 ? sdX - ddX : sdY - ddY);
      this.zBuf[x] = perpDist;

      const lH = Math.ceil(H / perpDist);
      const y0 = Math.max(0,     Math.floor(H / 2 - lH / 2));
      const y1 = Math.min(H - 1, Math.floor(H / 2 + lH / 2));

      ctx.fillStyle = this._wallColor(wallTile, side);
      ctx.fillRect(x, y0, 1, y1 - y0 + 1);
    }
  }

  /* ── Sprites (items & enemies) ───────────────────────────── */

  _spriteFor(tile, ent) {
    if (ent) {
      const col = ENEMY_COLORS[ent.type] || '#ff0000';
      return { color: col, sym: this._enemySyms[ent.type] || '?' };
    }
    return this._tileSprites[tile] || null;
  }

  _drawSprites(game, posX, posY, dX, dY, pX, pY) {
    const ctx  = this.ctx;
    const { W, H } = this;

    // Collect sprites from tile map (skip wall/floor/special tiles handled elsewhere).
    const sprs = [];
    for (let my = 0; my < game.mapH; my++) {
      for (let mx = 0; mx < game.mapW; mx++) {
        const tile = game.getTile(mx, my);
        if (!tile) continue;                          // floor
        if (this._isSolid(tile)) continue;            // handled by wall caster
        if (tile === T.TOGGLE_OPEN) continue;         // just a floor tile
        if (tile === T.DIRT || tile === T.GRAVEL) continue;
        if (ICE_TILES.has(tile) || FORCE_TILES.has(tile)) continue;
        if (tile === T.WATER || tile === T.FIRE) continue; // shown via floor casting
        const info = this._spriteFor(tile, null);
        if (info) sprs.push({ x: mx + 0.5, y: my + 0.5, info });
      }
    }

    // Collect entity sprites.
    for (const ent of game.entities) {
      if (!ent.alive || ent.type === E.PLAYER) continue;
      const info = this._spriteFor(null, ent);
      if (info) sprs.push({ x: ent.x + 0.5, y: ent.y + 0.5, info });
    }

    // Sort farthest-first (painter's algorithm).
    sprs.sort((a, b) =>
      ((b.x - posX) ** 2 + (b.y - posY) ** 2) -
      ((a.x - posX) ** 2 + (a.y - posY) ** 2)
    );

    // Inverse camera-matrix determinant.
    const det = dX * pY - pX * dY;
    if (Math.abs(det) < 1e-10) return;

    for (const sp of sprs) {
      const sx = sp.x - posX;
      const sy = sp.y - posY;

      // Transform into camera space.
      const tX = (-dY * sx + dX * sy) / det;   // horizontal (left/right)
      const tY = ( pY * sx - pX * sy) / det;   // depth

      if (tY <= 0.1) continue;   // behind or too close

      const scrX = Math.floor((W / 2) * (1 + tX / tY));

      // Scale sprite slightly smaller than wall height for a "sits on floor" look.
      const sH = Math.max(1, Math.floor(H / tY * 0.55));
      const sW = sH;
      const y0 = Math.max(0,     Math.floor(H / 2 - sH / 2));
      const y1 = Math.min(H - 1, Math.floor(H / 2 + sH / 2));
      const x0 = scrX - (sW >> 1);
      const x1 = scrX + (sW >> 1);

      // Draw column-by-column, respecting the depth buffer.
      let anyVisible = false;
      ctx.fillStyle = sp.info.color;
      for (let col = x0; col < x1; col++) {
        if (col < 0 || col >= W) continue;
        if (tY >= this.zBuf[col]) continue;   // occluded by wall
        const tx = Math.floor((col - x0) / sW * 4);
        ctx.globalAlpha = tx % 2 === 0 ? 1.0 : 0.65;
        ctx.fillRect(col, y0, 1, y1 - y0 + 1);
        anyVisible = true;
      }
      ctx.globalAlpha = 1;

      // Draw a symbol in the sprite centre when large enough to read.
      if (anyVisible && sH > 14) {
        const midX = Math.floor((x0 + x1) / 2);
        const midY = Math.floor((y0 + y1) / 2);
        if (midX >= 0 && midX < W) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.min(sH - 4, 22)}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sp.info.sym, midX, midY);
        }
      }
    }

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  /* ── Minimap overlay ─────────────────────────────────────── */

  _drawMinimap(game) {
    const ctx = this.ctx;
    const S = 5, PAD = 4;
    const mW = game.mapW * S;
    const mH = game.mapH * S;

    // Background panel.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(PAD, PAD, mW, mH);

    // Tile colours.
    for (let my = 0; my < game.mapH; my++) {
      for (let mx = 0; mx < game.mapW; mx++) {
        const t = game.getTile(mx, my);
        let col = null;
        if      (t === T.WALL)           col = '#5d7180';
        else if (DOOR_TILES.has(t))      col = DOOR_COLORS[t];
        else if (t === T.TOGGLE_CLOSED)  col = '#cc6e00';
        else if (t === T.EXIT)           col = '#00cc66';
        else if (t === T.WATER)          col = '#2266ff';
        else if (t === T.FIRE)           col = '#ff4400';
        else if (ICE_TILES.has(t))       col = '#aaddff';
        else if (t === T.CHIP)           col = '#ffd700';
        else if (KEY_TILES.has(t))       col = KEY_COLORS[t];
        else if (BOOT_TILES.has(t))      col = '#88ccff';
        else if (FORCE_TILES.has(t))     col = '#cccc00';
        if (col) {
          ctx.fillStyle = col;
          ctx.fillRect(PAD + mx * S, PAD + my * S, S, S);
        }
      }
    }

    // Enemies.
    for (const ent of game.entities) {
      if (!ent.alive || ent.type === E.PLAYER || ent.type === E.BLOCK) continue;
      ctx.fillStyle = ENEMY_COLORS[ent.type] || '#f00';
      ctx.fillRect(PAD + ent.x * S + 1, PAD + ent.y * S + 1, S - 2, S - 2);
    }

    // Player dot.
    const ppx = PAD + (game.player.x + 0.5) * S;
    const ppy = PAD + (game.player.y + 0.5) * S;
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(ppx, ppy, S / 2 + 1, 0, Math.PI * 2);
    ctx.fill();

    // Direction arrow.
    const [ax, ay] = this._arrowDirs[game.player.dir] || [0, 1];
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(ppx, ppy);
    ctx.lineTo(ppx + ax * S * 2, ppy + ay * S * 2);
    ctx.stroke();

    // Border.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(PAD, PAD, mW, mH);
  }

  /* ── HUD overlay (crosshair + 3D badge) ─────────────────── */

  _drawOverlay(game) {
    const ctx  = this.ctx;
    const { W, H } = this;

    // Crosshair.
    const cx = W / 2, cy = H / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
    ctx.stroke();

    // 3D mode badge (top-right).
    ctx.fillStyle    = 'rgba(255,204,0,0.9)';
    ctx.font         = 'bold 13px monospace';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('3D', W - 6, 6);

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}
