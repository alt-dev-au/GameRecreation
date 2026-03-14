# Shmo's Shenanigans

A browser-based web game built with vanilla JavaScript, HTML5 Canvas, and CSS. Play in classic 2D top-down view or switch to an immersive first-person 3D raycasting mode.

---

## 🎮 Play Now

**[https://alt-dev-au.github.io/GameRecreation/](https://alt-dev-au.github.io/GameRecreation/)**

No installation required — just open the link in any modern browser and start playing!

---

## About the Game

Shmo's Shenanigans is a tile-based puzzle game where you guide Shmo through maze-like levels filled with hazards, locked doors, and collectibles. Your goal is to gather all the computer chips on each level and reach the exit before time runs out.

This recreation includes:

- **5 hand-crafted levels** of increasing difficulty
- **2D mode** — classic top-down tile view
- **3D mode** — first-person raycasting perspective (Wolfenstein-style)
- Enemies (bugs, tanks, balls, gliders) with authentic movement logic
- Keys and colored doors
- Ice, water, fire, and force-floor tiles with matching boot pickups
- Hint tiles, toggle walls, teleporters, and more
- On-screen HUD showing level, time remaining, chips left, and inventory
- Mobile-friendly on-screen directional controls

---

## Controls

| Action | 2D Mode | 3D Mode |
|---|---|---|
| Move / Turn | Arrow Keys or WASD | ← → to turn, ↑ ↓ to move |
| Mobile | On-screen D-pad | On-screen D-pad |

---

## How to Run Locally

Because this project is pure vanilla JavaScript with no build step, you only need a static file server:

```bash
# Using Python 3
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

Alternatively, open `index.html` directly in your browser (most features work without a server).

---

## Project Structure

```
├── index.html          # Main HTML shell & UI screens
├── css/
│   └── style.css       # Retro dark theme styles
└── js/
    ├── game.js         # Game logic, 2D renderer, level data, entities
    └── renderer3d.js   # First-person 3D raycasting renderer
```

---

## Technologies

- **HTML5 Canvas** — rendering
- **Vanilla JavaScript** — all game logic (no frameworks or dependencies)
- **CSS3** — retro-styled UI
- **GitHub Pages** — hosting
