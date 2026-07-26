import {
  BALL_RADIUS,
  FRICTION,
  STOP_SPEED,
  CUSHION_RESTITUTION,
  BALL_RESTITUTION,
  POCKETS,
  POCKET_RADIUS,
  POCKET_CAPTURE,
  RAIL,
  TABLE_WIDTH,
  TABLE_HEIGHT,
  FOOT_SPOT,
  HEAD_STRING_X,
  BALLS,
} from '../constants';

export function createBall(number, x, y, color, stripe = false) {
  return {
    number,
    x,
    y,
    vx: 0,
    vy: 0,
    color,
    stripe,
    pocketed: false,
    sinking: false,
    sinkT: 0,
    sinkPocket: null,
    spinX: 0,
    spinY: 0,
  };
}

// Proper 9-ball diamond rack: 1-ball on the apex, 9-ball in the center,
// remaining balls placed randomly.
export function rackBalls() {
  const spacing = BALL_RADIUS * 2 + 0.5;
  const rows = [1, 2, 3, 2, 1];
  const positions = [];
  for (let row = 0; row < rows.length; row++) {
    const count = rows[row];
    const x = FOOT_SPOT.x + row * spacing * (Math.sqrt(3) / 2);
    const startY = FOOT_SPOT.y - ((count - 1) * spacing) / 2;
    for (let col = 0; col < count; col++) {
      positions.push({ x, y: startY + col * spacing });
    }
  }

  const others = [2, 3, 4, 5, 6, 7, 8];
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  // Position index 4 is the middle of the center row.
  const order = [1, others[0], others[1], others[2], 9, others[3], others[4], others[5], others[6]];

  const byNumber = new Map(BALLS.map(b => [b.number, b]));
  const balls = order.map((num, i) => {
    const spec = byNumber.get(num);
    return createBall(num, positions[i].x, positions[i].y, spec.color, spec.stripe);
  });

  balls.push(createBall(0, HEAD_STRING_X - 120, TABLE_HEIGHT / 2, '#f8fafc'));
  return balls;
}

function nearestPocket(x, y) {
  let pocket = null;
  let dist = Infinity;
  for (const p of POCKETS) {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < dist) {
      dist = d;
      pocket = p;
    }
  }
  return { pocket, dist };
}

// One frame of simulation, internally substepped so fast balls can't
// tunnel through each other or through cushions.
export function simulateStep(balls, handlers = {}) {
  let maxSpeed = 0;
  for (const b of balls) {
    if (!b.pocketed && !b.sinking) maxSpeed = Math.max(maxSpeed, Math.hypot(b.vx, b.vy));
  }
  const sub = Math.max(1, Math.ceil(maxSpeed / (BALL_RADIUS * 0.5)));
  const friction = Math.pow(FRICTION, 1 / sub);

  for (let s = 0; s < sub; s++) {
    for (const ball of balls) {
      if (ball.pocketed || ball.sinking) continue;
      ball.x += ball.vx / sub;
      ball.y += ball.vy / sub;
      ball.vx *= friction;
      ball.vy *= friction;
      if (Math.hypot(ball.vx, ball.vy) < STOP_SPEED) {
        ball.vx = 0;
        ball.vy = 0;
      }
    }
    resolveCushionCollisions(balls, handlers.onCushion);
    resolveBallCollisions(balls, handlers.onBallHit);
    checkPockets(balls, handlers.onPocket, sub);
  }

  for (const ball of balls) {
    if (!ball.sinking) continue;
    ball.sinkT = Math.min(1, ball.sinkT + 0.1);
    ball.x += (ball.sinkPocket.x - ball.x) * 0.35;
    ball.y += (ball.sinkPocket.y - ball.y) * 0.35;
    if (ball.sinkT >= 1) {
      ball.sinking = false;
      ball.pocketed = true;
      ball.vx = 0;
      ball.vy = 0;
    }
  }
}

export function resolveCushionCollisions(balls, onCushion) {
  for (const ball of balls) {
    if (ball.pocketed || ball.sinking) continue;
    // Inside a pocket mouth there is no cushion — let the ball fall in.
    const { dist } = nearestPocket(ball.x, ball.y);
    if (dist < POCKET_RADIUS + BALL_RADIUS * 0.4) continue;

    let bounced = false;
    if (ball.x - BALL_RADIUS < RAIL) {
      ball.x = RAIL + BALL_RADIUS;
      if (ball.vx < 0) { ball.vx = -ball.vx * CUSHION_RESTITUTION; bounced = true; }
    }
    if (ball.x + BALL_RADIUS > TABLE_WIDTH - RAIL) {
      ball.x = TABLE_WIDTH - RAIL - BALL_RADIUS;
      if (ball.vx > 0) { ball.vx = -ball.vx * CUSHION_RESTITUTION; bounced = true; }
    }
    if (ball.y - BALL_RADIUS < RAIL) {
      ball.y = RAIL + BALL_RADIUS;
      if (ball.vy < 0) { ball.vy = -ball.vy * CUSHION_RESTITUTION; bounced = true; }
    }
    if (ball.y + BALL_RADIUS > TABLE_HEIGHT - RAIL) {
      ball.y = TABLE_HEIGHT - RAIL - BALL_RADIUS;
      if (ball.vy > 0) { ball.vy = -ball.vy * CUSHION_RESTITUTION; bounced = true; }
    }

    if (bounced) {
      if (ball.spinX) {
        // Side spin (english) bends the rebound angle
        const a = ball.spinX * 0.25;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const { vx, vy } = ball;
        ball.vx = vx * cos - vy * sin;
        ball.vy = vx * sin + vy * cos;
        ball.spinX *= 0.5;
      }
      if (onCushion) onCushion(ball, Math.hypot(ball.vx, ball.vy));
    }
  }
}

export function resolveBallCollisions(balls, onBallHit) {
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const b = balls[j];
      if (a.pocketed || b.pocketed || a.sinking || b.sinking) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= BALL_RADIUS * 2 || dist === 0) continue;

      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = BALL_RADIUS * 2 - dist;
      a.x -= nx * overlap / 2;
      a.y -= ny * overlap / 2;
      b.x += nx * overlap / 2;
      b.y += ny * overlap / 2;

      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel >= 0) continue;

      const impulse = -(1 + BALL_RESTITUTION) * rel / 2;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;

      // Follow/draw from vertical spin on the cue ball
      const cue = a.number === 0 ? a : b.number === 0 ? b : null;
      if (cue && cue.spinY) {
        const dir = cue === a ? 1 : -1;
        const strength = Math.min(Math.abs(rel), 18);
        cue.vx += nx * dir * cue.spinY * strength * 0.35;
        cue.vy += ny * dir * cue.spinY * strength * 0.35;
        cue.spinY *= 0.25;
      }

      if (onBallHit) onBallHit(a, b, Math.abs(rel));
    }
  }
}

export function checkPockets(balls, onPocket, sub = 1) {
  for (const ball of balls) {
    if (ball.pocketed || ball.sinking) continue;
    const { pocket, dist } = nearestPocket(ball.x, ball.y);
    const speed = Math.hypot(ball.vx, ball.vy);

    if (dist < POCKET_CAPTURE) {
      ball.sinking = true;
      ball.sinkT = 0;
      ball.sinkPocket = pocket;
      if (onPocket) onPocket(ball);
      continue;
    }
    // Pocket "gravity": moving balls hanging over the edge get pulled in
    if (speed > 0 && dist < POCKET_RADIUS * 1.6) {
      const pull = 0.35 / sub;
      ball.vx += ((pocket.x - ball.x) / dist) * pull;
      ball.vy += ((pocket.y - ball.y) / dist) * pull;
    }
    // Safety clamp: nothing ever leaves the canvas
    if (ball.x < BALL_RADIUS) { ball.x = BALL_RADIUS; ball.vx = Math.abs(ball.vx) * 0.5; }
    if (ball.x > TABLE_WIDTH - BALL_RADIUS) { ball.x = TABLE_WIDTH - BALL_RADIUS; ball.vx = -Math.abs(ball.vx) * 0.5; }
    if (ball.y < BALL_RADIUS) { ball.y = BALL_RADIUS; ball.vy = Math.abs(ball.vy) * 0.5; }
    if (ball.y > TABLE_HEIGHT - BALL_RADIUS) { ball.y = TABLE_HEIGHT - BALL_RADIUS; ball.vy = -Math.abs(ball.vy) * 0.5; }
  }
}

export function allBallsStopped(balls) {
  return balls.every(b => b.pocketed || (!b.sinking && b.vx === 0 && b.vy === 0));
}

export function placeCueBall(ball, x, y) {
  ball.pocketed = false;
  ball.sinking = false;
  ball.sinkT = 0;
  ball.x = x;
  ball.y = y;
  ball.vx = 0;
  ball.vy = 0;
  ball.spinX = 0;
  ball.spinY = 0;
}

export function canPlaceCueBall(balls, x, y, kitchenOnly = false) {
  if (x < RAIL + BALL_RADIUS || x > TABLE_WIDTH - RAIL - BALL_RADIUS) return false;
  if (y < RAIL + BALL_RADIUS || y > TABLE_HEIGHT - RAIL - BALL_RADIUS) return false;
  if (kitchenOnly && x > HEAD_STRING_X) return false;
  for (const b of balls) {
    if (b.number === 0 || b.pocketed) continue;
    if (Math.hypot(b.x - x, b.y - y) < BALL_RADIUS * 2 + 1) return false;
  }
  return true;
}

function spotIsFree(balls, x, y) {
  return balls.every(
    b => b.number === 9 || b.pocketed || Math.hypot(b.x - x, b.y - y) >= BALL_RADIUS * 2 + 1
  );
}

// The 9-ball comes back to the foot spot when pocketed on a foul
export function respotNine(balls) {
  const nine = balls.find(b => b.number === 9);
  if (!nine) return;
  nine.pocketed = false;
  nine.sinking = false;
  nine.sinkT = 0;
  nine.vx = 0;
  nine.vy = 0;
  let x = FOOT_SPOT.x;
  while (!spotIsFree(balls, x, FOOT_SPOT.y) && x < TABLE_WIDTH - RAIL - BALL_RADIUS) {
    x += BALL_RADIUS;
  }
  nine.x = x;
  nine.y = FOOT_SPOT.y;
}

export function getCueBall(balls) {
  return balls.find(b => b.number === 0);
}
