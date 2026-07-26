# 9-Ball Pool

A two-player 9-ball pool game built with React, Vite, and the HTML canvas.

## How to play

- **Aim** by moving the mouse — the assist shows the cue path, the ghost ball at contact, the object ball's predicted path, and the cue ball's deflection.
- **Shoot** by click-dragging backwards from your aim line and releasing (drag distance = power), or set the power slider and press **Space** / click **Shoot**. Scroll the mouse wheel to fine-tune power.
- **Spin**: click the spin pad to add english (sides), follow (top), or draw (bottom).

## Rules (real 9-ball)

- Players alternate turns; the lowest-numbered ball must always be struck first.
- Pocket any ball off a legal hit and you keep shooting.
- Fouls (scratch, wrong ball first, no contact, no rail after contact) give the opponent **ball in hand** — place the cue ball anywhere.
- Pocket the **9-ball** on a legal shot to win the rack. Pocketing the 9 on a foul respots it.
- Rack wins are tracked on the scoreboard; the winner breaks the next rack.

## Tech

- Substepped 2D physics (no tunneling at high speed), cushion restitution, pocket capture with sink animation, spin-influenced collisions and rebounds.
- Rendering: cached table layer + per-frame ball/aim drawing at devicePixelRatio, driven by `requestAnimationFrame`; React only re-renders the HUD.
- Synthesized sound effects via the Web Audio API (no audio assets).

## Scripts

```sh
npm run dev      # start the dev server
npm run build    # production build
npm run lint     # oxlint
```
