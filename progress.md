Original prompt: [$develop-web-game](/Users/sungchulkang/.codex/skills/develop-web-game/SKILL.md) 을 이용해서, web game 으로 변경해줘

- Initial scan: project is already HTML/JS canvas game (`index.html`, `game.js`, `style.css`).
- Missing required hooks from skill: `window.render_game_to_text`, deterministic `window.advanceTime(ms)`, fullscreen toggle key (`f`).
- Plan: add hooks and deterministic stepping, then run Playwright client and inspect screenshot/state/errors.

## Update 1 - Required hooks added
- Added deterministic simulation timing (`simTime`, accumulators) and `advanceSimulation(ms)`.
- Added `window.advanceTime(ms)` for fixed-step deterministic progression.
- Added `window.render_game_to_text()` with coordinate-system note and concise live state.
- Added fullscreen toggle on `f` and resize handling on `fullscreenchange`.
- Refactored status TTL checks to use simulation time.

## Update 2 - Control + deterministic timing hardening
- Added keyboard controls: Arrow/WASD move, Space pause/resume, R restart, F fullscreen.
- Added `restartGame()` and included controls metadata in `window.render_game_to_text` payload.
- Replaced remaining `performance.now()` references in slow-motion timing with simulation time (`simTime`) for deterministic stepping consistency.
- Updated start overlay copy to list controls.

## Test environment note
- Playwright process currently hangs at browser launch in this environment (even with local Chrome executable fallback), so automated screenshot/state capture is blocked by runtime constraints.

## Update 3 - Skill client run result
- Ran `$WEB_GAME_CLIENT` directly with `file://` URL and action payload.
- Result: failed immediately with `ERR_MODULE_NOT_FOUND` for package `playwright` because the skill script path (`~/.codex/skills/...`) cannot resolve a local `playwright` dependency in this restricted environment.

## Update 4 - Worm overlap visual fix
- Reduced worm render scale from `2.4` to `1.65` to reduce segment overlap that made the worm look shorter than its logical length.
- Added `wormCollisionScale` and kept collision/eat radius on previous scale (`2.4`) so gameplay hit feel remains unchanged while visuals are corrected.

## Update 5 - Keep worm large while preserving grid movement
- Increased visual worm size to `wormRenderScale = 2.25` (larger on screen).
- Kept movement/collision grid unchanged.
- Added render-only segment stretch (`wormRenderStretch = 0.34`, `enemyRenderStretch = 0.26`) so segments visually overlap less and worm length reads correctly without altering gameplay logic.

## Update 6 - 4-cell bundle render model
- Switched worm/enemy visual occupancy from single-cell style to `2x2` block rendering via `wormRenderBlockCells = 2`.
- Kept gameplay movement grid and world logic unchanged (`gridSize`, positions, and step logic remain the same).
- Removed render stretch offsets; size now comes from block-based rendering so worms look large and stable while moving on the same grid.

## Update 7 - Render bundle 3x3
- Changed worm visual block occupancy from 2x2 to 3x3 (`wormRenderBlockCells = 3`).
- Gameplay grid movement/collision logic remains unchanged.

## Update 8 - 20x20 grid + 1:1 cell collision
- Changed base grid size to `20` so worms and enemies operate on 20x20 cell units.
- Set worm visual block occupancy to single cell (`wormRenderBlockCells = 1`) because the cell itself is now 20x20.
- Replaced radius-based collision/eat checks with strict cell match (1:1 overlap):
  - player head vs spice
  - enemy head vs spice
  - player vs enemy body/head
  - enemy vs enemy body/head

## Update 9 - Scale up to 30x30
- Scaled base gameplay grid from 20x20 to 30x30 (`gridSize = 30`), i.e. 1.5x larger as requested.
- Cell-based 1:1 collision model remains unchanged.

## Update 10 - Worm visual scale aligned to 30x30 grid
- Increased worm/enemy visual occupancy from 1 cell to 2 cells (`wormRenderBlockCells = 2`) so worms look appropriately larger on 30x30 grid.
- Movement and 1:1 cell collision logic unchanged.

## Update 11 - 30x30 red debug outlines
- Added 30x30 red outline boxes around player worm segments, enemy worm segments, and animal/spice cells for visual cell-size debugging.
- Toggle via `debugCellOutline` constant in `game.js`.

## Update 12 - Worm 5x5-cell basis + 50x50 unit collision boxes
- Introduced sizing model: `baseCellSize=10`, `wormUnitCells=5`, `unitPixelSize=50`, and bound `gridSize` to 50.
- Unified unit visuals to 50x50 while keeping grid-based movement logic.
- Replaced strict same-cell collision checks with 50x50 AABB overlap (`unitRect` / `unitsOverlap`) for:
  - player vs spice
  - enemy vs spice
  - player vs enemy
  - enemy vs enemy
- Kept red debug collision outlines and matched them to 50x50 (`debugCellSize=unitPixelSize`).

## Update 13 - Diagonal visual length compensation
- Added render-only diagonal spacing compensation (`diagonalRenderCompression`) so body links do not look stretched during diagonal movement.
- Applied to both player worm and enemy worms.
- Gameplay logic, movement grid, and collision remain unchanged.

## Update 14 - Animal collision size synced to visual size
- Added `spiceCollisionRect()` so animal/spice hitboxes match visual render size (`gridSize * creatureRenderScale`).
- Updated player/enemy vs spice collision checks to use AABB overlap against `spiceCollisionRect`.
- Updated red debug outline for spices to draw the same collision rectangle size.

## Update 15 - Spice hitbox reduced to 80%
- Added `spiceCollisionScale = 0.8`.
- Spice collision rectangles now use 80% of rendered spice size.
- Red debug outlines for spices remain exactly aligned with the active spice collision rectangles.

## Update 16 - Fixed enemy count + predator growth on enemy collisions
- Added fixed enemy population target (`enemyTargetCount = 3`) and changed `ensureEnemyCount()` to always maintain this count.
- `resetGame()` now initializes enemies using the same fixed target.
- Added `growEnemyBy(enemy, eatenLength)` to let winning enemy gain length from defeated enemy.
- Updated enemy-vs-enemy collision resolution:
  - Longer enemy survives and eats (gains loser length).
  - Equal length now resolves to one random winner that eats the other.
- Added `ensureEnemyCount()` call at end of collision resolution to refill immediately when enemies are removed.

## Update 17 - Top-left score + top-right minimap
- Moved HUD/score panel to top-left via CSS.
- Added semi-transparent minimap panel at top-right (`#minimap`).
- Implemented minimap rendering for all units:
  - player worm segments (head highlighted)
  - enemy worm segments
  - spice/animals
  - current camera viewport rectangle

## Update 18 - Minimap viewport width reflection + 70% slower gameplay
- Minimap viewport rectangle now explicitly uses current screen width/height (`window.innerWidth/innerHeight`) when computing visible region box.
- Added `gameplaySpeedMultiplier = 0.3` and applied it to player/enemy simulation intervals, resulting in ~70% slower game progression.

## Update 19 - Equal visual segment spacing for diagonal vs straight movement
- Replaced diagonal compression constant approach with `getRenderedSegments()`.
- New render path computes segment positions with normalized direction vectors and fixed per-link pixel distance (`gridSize`).
- Result: visual segment spacing stays consistent for straight and diagonal movement.
