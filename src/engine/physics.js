import { BALL_RADIUS, FRICTION, STOP_SPEED, POCKETS, POCKET_RADIUS } from '../constants';

export function createBall(number, x, y, color) {
  return {
    number,
    x,
    y,
    vx: 0,
    vy: 0,
    color,
    pocketed: false,
    scratchAfterFoul: false,
  };
}

export function rackBalls() {
  const balls = [];
  const startX = 850;
  const startY = 300;
  const gap = BALL_RADIUS * 2 + 1;
  // 9-ball rack: triangle with 3 rows
  const rows = 3;
  let idx = 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col <= row; col++) {
      const x = startX + row * gap * 0.866;
      const y = startY + (col - row / 2) * gap;
      const colors = [
        '#f4d03f', // 1 yellow
        '#2e86de', // 2 blue
        '#e74c3c', // 3 red
        '#8e44ad', // 4 purple
        '#f39c12', // 5 orange
        '#27ae60', // 6 green
        '#c0392b', // 7 maroon
        '#2c3e50', // 8 black
        '#f1c40f', // 9 yellow stripe
      ];
      balls.push(createBall(idx, x, y, colors[idx - 1]));
      idx++;
    }
  }
  // Cue ball
  balls.push(createBall(0, 250, 300, '#ffffff'));
  return balls;
}

export function moveBalls(balls) {
  for (const ball of balls) {
    if (ball.pocketed) continue;
    const speed = Math.hypot(ball.vx, ball.vy);
    // Apply sliding friction when moving, rolling friction when slow
    const friction = speed > 1.5 ? FRICTION : 0.995;
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= friction;
    ball.vy *= friction;
    if (Math.hypot(ball.vx, ball.vy) < STOP_SPEED) {
      ball.vx = 0;
      ball.vy = 0;
    }
  }
}

export function resolveCushionCollisions(balls, width, height, rail) {
  for (const ball of balls) {
    if (ball.pocketed) continue;
    if (ball.x - BALL_RADIUS < rail) {
      ball.x = rail + BALL_RADIUS;
      ball.vx = -ball.vx * 0.78;
    }
    if (ball.x + BALL_RADIUS > width - rail) {
      ball.x = width - rail - BALL_RADIUS;
      ball.vx = -ball.vx * 0.78;
    }
    if (ball.y - BALL_RADIUS < rail) {
      ball.y = rail + BALL_RADIUS;
      ball.vy = -ball.vy * 0.78;
    }
    if (ball.y + BALL_RADIUS > height - rail) {
      ball.y = height - rail - BALL_RADIUS;
      ball.vy = -ball.vy * 0.78;
    }
  }
}

export function resolveBallCollisions(balls) {
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const b = balls[j];
      if (a.pocketed || b.pocketed) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < BALL_RADIUS * 2 && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = BALL_RADIUS * 2 - dist;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;
        const dvx = b.vx - a.vx;
        const dvy = b.vy - a.vy;
        const velocityAlongNormal = dvx * nx + dvy * ny;
        if (velocityAlongNormal > 0) continue;
        const restitution = 0.92;
        const impulse = -(1 + restitution) * velocityAlongNormal / 2;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
    }
  }
}

export function checkPockets(balls) {
  const pocketed = [];
  for (const ball of balls) {
    if (ball.pocketed) continue;
    for (const pocket of POCKETS) {
      if (Math.hypot(ball.x - pocket.x, ball.y - pocket.y) < POCKET_RADIUS - 2) {
        ball.pocketed = true;
        ball.vx = 0;
        ball.vy = 0;
        pocketed.push(ball);
        break;
      }
    }
  }
  return pocketed;
}

export function allBallsStopped(balls) {
  return balls.every(b => b.pocketed || (b.vx === 0 && b.vy === 0));
}

export function placeCueBall(ball, x, y) {
  ball.pocketed = false;
  ball.x = x;
  ball.y = y;
  ball.vx = 0;
  ball.vy = 0;
}

export function getCueBall(balls) {
  return balls.find(b => b.number === 0);
}
