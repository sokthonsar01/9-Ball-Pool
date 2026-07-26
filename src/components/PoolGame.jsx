import { useEffect, useRef, useState, useCallback } from 'react';
import {
  TABLE_WIDTH,
  TABLE_HEIGHT,
  RAIL,
  BALL_RADIUS,
  POCKETS,
  POCKET_RADIUS,
  MAX_POWER,
  MIN_POWER,
  SHOT_POWER_SCALE,
  AIM_LINE_LENGTH,
  HEAD_STRING_X,
  BALLS,
} from '../constants';
import {
  rackBalls,
  simulateStep,
  allBallsStopped,
  getCueBall,
  placeCueBall,
  canPlaceCueBall,
  respotNine,
} from '../engine/physics';
import { evaluateShot, lowestRemaining, formatBall } from '../engine/rules';
import './PoolGame.css';

const VIEW_SCALE = 0.9;
const STRIKE_MS = 100;
const PLAYER_NAMES = ['Player 1', 'Player 2'];

/* ---------- rendering helpers (all in table coordinates) ---------- */

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function buildTableCanvas() {
  const res = 2;
  const c = document.createElement('canvas');
  c.width = TABLE_WIDTH * res;
  c.height = TABLE_HEIGHT * res;
  const ctx = c.getContext('2d');
  ctx.scale(res, res);

  // Wood frame
  const wood = ctx.createLinearGradient(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
  wood.addColorStop(0, '#6b4a2b');
  wood.addColorStop(0.5, '#8a5f36');
  wood.addColorStop(1, '#52351e');
  roundRectPath(ctx, 0, 0, TABLE_WIDTH, TABLE_HEIGHT, 26);
  ctx.fillStyle = wood;
  ctx.fill();

  // Cushion ring
  roundRectPath(ctx, RAIL * 0.55, RAIL * 0.55, TABLE_WIDTH - RAIL * 1.1, TABLE_HEIGHT - RAIL * 1.1, 14);
  ctx.fillStyle = '#1d4a2e';
  ctx.fill();

  // Felt
  ctx.fillStyle = '#2f7d4a';
  ctx.fillRect(RAIL, RAIL, TABLE_WIDTH - RAIL * 2, TABLE_HEIGHT - RAIL * 2);
  const vignette = ctx.createRadialGradient(
    TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 120,
    TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 700
  );
  vignette.addColorStop(0, 'rgba(255,255,255,0.05)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vignette;
  ctx.fillRect(RAIL, RAIL, TABLE_WIDTH - RAIL * 2, TABLE_HEIGHT - RAIL * 2);

  // Head string
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(HEAD_STRING_X, RAIL);
  ctx.lineTo(HEAD_STRING_X, TABLE_HEIGHT - RAIL);
  ctx.stroke();

  // Diamond sights on the rails
  const innerW = TABLE_WIDTH - RAIL * 2;
  const innerH = TABLE_HEIGHT - RAIL * 2;
  ctx.fillStyle = '#e7d9a8';
  const diamond = (x, y) => {
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x - 3, y);
    ctx.closePath();
    ctx.fill();
  };
  for (let i = 1; i <= 7; i++) {
    if (i === 4) continue; // side pockets
    diamond(RAIL + (innerW * i) / 8, RAIL * 0.28);
    diamond(RAIL + (innerW * i) / 8, TABLE_HEIGHT - RAIL * 0.28);
  }
  for (let i = 1; i <= 3; i++) {
    if (i === 2) continue; // aligned with nothing on short rails, keep 1/4 & 3/4
    diamond(RAIL * 0.28, RAIL + (innerH * i) / 4);
    diamond(TABLE_WIDTH - RAIL * 0.28, RAIL + (innerH * i) / 4);
  }

  // Pockets
  for (const p of POCKETS) {
    const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, POCKET_RADIUS);
    g.addColorStop(0, '#000');
    g.addColorStop(0.72, '#0a0a0a');
    g.addColorStop(1, '#262626');
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(212,175,55,0.4)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  return c;
}

function drawBallSprite(ctx, ball) {
  const scale = ball.sinking ? 1 - ball.sinkT * 0.65 : 1;
  const r = BALL_RADIUS * scale;
  const { x, y } = ball;
  ctx.save();
  if (ball.sinking) ctx.globalAlpha = 1 - ball.sinkT * 0.6;

  // Drop shadow on the felt
  ctx.beginPath();
  ctx.ellipse(x + r * 0.18, y + r * 0.28, r * 0.9, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();

  const base = ball.stripe || ball.number === 0 ? '#f8fafc' : ball.color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = base;
  ctx.fill();

  if (ball.stripe) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = ball.color;
    ctx.fillRect(x - r, y - r * 0.52, r * 2, r * 1.04);
    ctx.restore();
  }

  if (ball.number > 0) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.48, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.font = `700 ${Math.max(7, r * 0.72)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ball.number, x, y + r * 0.04);
  }

  // Spherical shading + specular highlight
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  grad.addColorStop(0, 'rgba(255,255,255,0.5)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.1)');
  grad.addColorStop(0.75, 'rgba(0,0,0,0.12)');
  grad.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.restore();
}

function drawCueStick(ctx, x, y, angle, pull) {
  const gap = BALL_RADIUS + 8 + pull;
  const len = 340;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.translate(-gap, 0);
  const grad = ctx.createLinearGradient(-len, 0, 0, 0);
  grad.addColorStop(0, '#3b2414');
  grad.addColorStop(0.5, '#8a5a2e');
  grad.addColorStop(0.95, '#c99e63');
  ctx.beginPath();
  ctx.moveTo(-10, -2.4);
  ctx.lineTo(-len, -5);
  ctx.lineTo(-len, 5);
  ctx.lineTo(-10, 2.4);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.fillStyle = '#e8e3d8';
  ctx.fillRect(-10, -2.4, 7, 4.8);
  ctx.fillStyle = '#4f83c2';
  ctx.fillRect(-3, -2.2, 3, 4.4);
  ctx.restore();
}

function findFirstBallOnRay(cueBall, angle, balls) {
  let nearest = null;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  for (const b of balls) {
    if (b.pocketed || b.sinking || b.number === 0) continue;
    const dx = b.x - cueBall.x;
    const dy = b.y - cueBall.y;
    const projection = dx * dirX + dy * dirY;
    if (projection <= 0) continue;
    const perpX = dx - projection * dirX;
    const perpY = dy - projection * dirY;
    const perpDist = Math.hypot(perpX, perpY);
    if (perpDist <= BALL_RADIUS * 2) {
      const impactDist = projection - Math.sqrt((BALL_RADIUS * 2) ** 2 - perpDist ** 2);
      if (impactDist > 0 && (!nearest || impactDist < nearest.dist)) {
        nearest = {
          ball: b,
          dist: impactDist,
          impactX: cueBall.x + dirX * impactDist,
          impactY: cueBall.y + dirY * impactDist,
        };
      }
    }
  }
  return nearest;
}

function drawAimAssist(ctx, cue, angle, power, balls) {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const hit = findFirstBallOnRay(cue, angle, balls);
  const lineEnd = hit ? hit.dist : AIM_LINE_LENGTH;

  // Aim line from the cue ball to the first contact (or fixed length)
  ctx.beginPath();
  ctx.moveTo(cue.x + dirX * BALL_RADIUS, cue.y + dirY * BALL_RADIUS);
  ctx.lineTo(cue.x + dirX * lineEnd, cue.y + dirY * lineEnd);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 6]);
  ctx.stroke();

  if (hit) {
    // Ghost cue ball at the moment of contact
    ctx.beginPath();
    ctx.arc(hit.impactX, hit.impactY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Predicted object ball path
    const ndx = hit.ball.x - hit.impactX;
    const ndy = hit.ball.y - hit.impactY;
    const nlen = Math.hypot(ndx, ndy) || 1;
    const nx = ndx / nlen;
    const ny = ndy / nlen;
    ctx.beginPath();
    ctx.moveTo(hit.ball.x, hit.ball.y);
    ctx.lineTo(hit.ball.x + nx * 160, hit.ball.y + ny * 160);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Predicted cue ball deflection (tangent line)
    const dot = dirX * nx + dirY * ny;
    let tx = dirX - dot * nx;
    let ty = dirY - dot * ny;
    const tlen = Math.hypot(tx, ty);
    if (tlen > 0.15) {
      tx /= tlen;
      ty /= tlen;
      ctx.beginPath();
      ctx.moveTo(hit.impactX, hit.impactY);
      ctx.lineTo(hit.impactX + tx * 70, hit.impactY + ty * 70);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Power ring around the cue ball
  const frac = power / MAX_POWER;
  ctx.beginPath();
  ctx.arc(cue.x, cue.y, BALL_RADIUS + 7, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.strokeStyle = `hsl(${(1 - frac) * 120}, 90%, 55%)`;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/* ---------- synthesized sound effects ---------- */

function createAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.4;
  master.connect(ctx.destination);

  const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const clack = (vol) => {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3200;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(vol, 1), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + 0.08);
  };

  const thud = (vol) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(vol, 0.8), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.14);
  };

  const drop = () => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.22);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.3);
    clack(0.35);
  };

  return { ctx, clack, thud, drop };
}

/* ---------- component ---------- */

function makeInitialGame() {
  return {
    balls: rackBalls(),
    turn: 0,
    wins: [0, 0],
    ballInHand: false,
    busy: false,
    over: false,
    winner: null,
    message: 'Player 1 to break. Drag back from your aim line and release to shoot — or set power and press Space.',
  };
}

function uiFromGame(g) {
  return {
    turn: g.turn,
    wins: [...g.wins],
    message: g.message,
    target: lowestRemaining(g.balls),
    pocketedNumbers: g.balls
      .filter(b => b.number > 0 && (b.pocketed || b.sinking))
      .map(b => b.number),
    ballInHand: g.ballInHand,
    busy: g.busy,
    over: g.over,
    winner: g.winner,
  };
}

export default function PoolGame() {
  const canvasRef = useRef(null);
  const tableRef = useRef(null);
  const gameRef = useRef(null);
  if (!gameRef.current) gameRef.current = makeInitialGame();

  const aimRef = useRef({ angle: 0, mouse: { x: 300, y: 300 } });
  const dragRef = useRef(null);
  const pendingShotRef = useRef(null);
  const shootingRef = useRef(false);
  const shotDataRef = useRef({ firstHit: null, pocketed: [], railAfterContact: false, target: 1 });
  const powerRef = useRef(30);
  const spinRef = useRef({ x: 0, y: 0 });
  const audioRef = useRef(null);
  const lastClackRef = useRef(0);

  const [ui, setUi] = useState(() => uiFromGame(gameRef.current));
  const [power, setPowerState] = useState(30);
  const [spin, setSpin] = useState({ x: 0, y: 0 });

  const syncUi = useCallback(() => {
    setUi(uiFromGame(gameRef.current));
  }, []);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.ctx.resume?.();
      return;
    }
    try {
      audioRef.current = createAudio();
    } catch {
      audioRef.current = null;
    }
  }, []);

  const sfx = useCallback((type, vol = 0.5) => {
    const a = audioRef.current;
    if (!a) return;
    if (type === 'clack') {
      const now = performance.now();
      if (now - lastClackRef.current < 40) return;
      lastClackRef.current = now;
      a.clack(vol);
    } else if (type === 'thud') {
      a.thud(vol);
    } else if (type === 'drop') {
      a.drop();
    }
  }, []);

  const resetSpin = useCallback(() => {
    spinRef.current = { x: 0, y: 0 };
    setSpin({ x: 0, y: 0 });
  }, []);

  const resolveShot = useCallback(() => {
    const g = gameRef.current;
    const s = shotDataRef.current;
    const cue = getCueBall(g.balls);
    const pocketedObjects = s.pocketed.filter(b => b.number > 0);
    const { legal, foul } = evaluateShot({
      cueScratched: cue.pocketed,
      firstHit: s.firstHit,
      targetNumber: s.target,
      pocketed: pocketedObjects,
      railAfterContact: s.railAfterContact,
    });
    const ninePocketed = pocketedObjects.some(b => b.number === 9);
    g.busy = false;

    if (legal && ninePocketed) {
      g.over = true;
      g.winner = g.turn;
      g.wins[g.turn] += 1;
      g.message = `${PLAYER_NAMES[g.turn]} pockets the 9-ball and wins the rack!`;
      resetSpin();
      syncUi();
      return;
    }

    const pottedText = pocketedObjects.length
      ? ` Potted: ${pocketedObjects.map(b => formatBall(b.number)).join(', ')}.`
      : '';

    if (!legal) {
      if (ninePocketed) respotNine(g.balls);
      g.turn = 1 - g.turn;
      g.ballInHand = true;
      g.message = `Foul — ${foul}.${pottedText} ${PLAYER_NAMES[g.turn]} has ball in hand: click the table to place the cue ball.`;
    } else if (pocketedObjects.length > 0) {
      g.message = `Nice!${pottedText} ${PLAYER_NAMES[g.turn]} shoots again — target: ${formatBall(lowestRemaining(g.balls))}.`;
    } else {
      g.turn = 1 - g.turn;
      g.message = `Safe shot. ${PLAYER_NAMES[g.turn]} is up — target: ${formatBall(lowestRemaining(g.balls))}.`;
    }
    resetSpin();
    syncUi();
  }, [resetSpin, syncUi]);

  const startShot = useCallback((shotPower) => {
    const g = gameRef.current;
    if (g.over || g.ballInHand || shootingRef.current || pendingShotRef.current) return;
    const cue = getCueBall(g.balls);
    if (!cue || cue.pocketed || !allBallsStopped(g.balls)) return;
    const p = Math.min(Math.max(shotPower, MIN_POWER), MAX_POWER);
    pendingShotRef.current = {
      t0: performance.now(),
      angle: aimRef.current.angle,
      power: p,
      fromPull: 10 + (p / MAX_POWER) * 70,
    };
    g.busy = true;
    syncUi();
  }, [syncUi]);

  const newRack = useCallback(() => {
    const g = gameRef.current;
    const breaker = g.winner != null ? g.winner : g.turn;
    gameRef.current = {
      ...makeInitialGame(),
      turn: breaker,
      wins: g.wins,
      message: `New rack — ${PLAYER_NAMES[breaker]} breaks. Target: 1-ball.`,
    };
    shootingRef.current = false;
    pendingShotRef.current = null;
    dragRef.current = null;
    resetSpin();
    syncUi();
  }, [resetSpin, syncUi]);

  // Main loop: physics + rendering run off requestAnimationFrame; React only
  // re-renders when the HUD actually changes.
  useEffect(() => {
    tableRef.current = buildTableCanvas();
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(TABLE_WIDTH * VIEW_SCALE * dpr);
    canvas.height = Math.round(TABLE_HEIGHT * VIEW_SCALE * dpr);

    const firePendingShot = () => {
      const g = gameRef.current;
      const { angle, power: p } = pendingShotRef.current;
      pendingShotRef.current = null;
      const cue = getCueBall(g.balls);
      cue.vx = Math.cos(angle) * p * SHOT_POWER_SCALE;
      cue.vy = Math.sin(angle) * p * SHOT_POWER_SCALE;
      cue.spinX = spinRef.current.x;
      cue.spinY = -spinRef.current.y; // pad top = follow, pad bottom = draw
      shotDataRef.current = {
        firstHit: null,
        pocketed: [],
        railAfterContact: false,
        target: lowestRemaining(g.balls),
      };
      shootingRef.current = true;
      sfx('clack', Math.min(1, p / MAX_POWER));
    };

    const handlers = {
      onBallHit: (a, b, impact) => {
        const s = shotDataRef.current;
        if (!s.firstHit) {
          if (a.number === 0 && b.number > 0) s.firstHit = b;
          else if (b.number === 0 && a.number > 0) s.firstHit = a;
        }
        if (impact > 1.5) sfx('clack', Math.min(0.9, impact / 22));
      },
      onCushion: (_ball, speed) => {
        if (shotDataRef.current.firstHit) shotDataRef.current.railAfterContact = true;
        if (speed > 2) sfx('thud', Math.min(0.7, speed / 20));
      },
      onPocket: (ball) => {
        shotDataRef.current.pocketed.push(ball);
        sfx('drop');
      },
    };

    const drawFrame = () => {
      const ctx = canvas.getContext('2d');
      const scaleAll = canvas.width / TABLE_WIDTH;
      ctx.setTransform(scaleAll, 0, 0, scaleAll, 0, 0);
      ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
      ctx.drawImage(tableRef.current, 0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      const g = gameRef.current;
      const cue = getCueBall(g.balls);
      const idle = !shootingRef.current && !pendingShotRef.current && !g.over;

      // Pulsing ring around the current target ball
      if (idle && !g.ballInHand) {
        const targetNum = lowestRemaining(g.balls);
        const tb = g.balls.find(b => b.number === targetNum && !b.pocketed);
        if (tb) {
          const pulse = 3.5 + Math.sin(performance.now() / 220) * 1.5;
          ctx.beginPath();
          ctx.arc(tb.x, tb.y, BALL_RADIUS + pulse, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      for (const b of g.balls) if (!b.pocketed && b.sinking) drawBallSprite(ctx, b);
      for (const b of g.balls) if (!b.pocketed && !b.sinking) drawBallSprite(ctx, b);

      if (g.ballInHand && !g.over) {
        const { x, y } = aimRef.current.mouse;
        const ok = canPlaceCueBall(g.balls, x, y);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = ok ? '#f8fafc' : '#ef4444';
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (idle && cue && !cue.pocketed) {
        const drag = dragRef.current;
        const shownPower = drag ? drag.power : powerRef.current;
        const angle = drag ? drag.angle : aimRef.current.angle;
        drawAimAssist(ctx, cue, angle, shownPower, g.balls);
        drawCueStick(ctx, cue.x, cue.y, angle, 6 + (shownPower / MAX_POWER) * 80);
      }

      // Cue strike animation
      if (pendingShotRef.current && cue) {
        const ps = pendingShotRef.current;
        const t = Math.min(1, (performance.now() - ps.t0) / STRIKE_MS);
        drawCueStick(ctx, cue.x, cue.y, ps.angle, ps.fromPull * (1 - t * t));
      }
    };

    let raf;
    const loop = () => {
      const g = gameRef.current;
      if (pendingShotRef.current && performance.now() - pendingShotRef.current.t0 >= STRIKE_MS) {
        firePendingShot();
      }
      if (shootingRef.current) {
        simulateStep(g.balls, handlers);
        if (allBallsStopped(g.balls)) {
          shootingRef.current = false;
          resolveShot();
        }
      }
      drawFrame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [resolveShot, sfx]);

  const toTable = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * TABLE_WIDTH) / rect.width,
      y: ((e.clientY - rect.top) * TABLE_HEIGHT) / rect.height,
    };
  };

  const handlePointerMove = useCallback((e) => {
    const pos = toTable(e);
    aimRef.current.mouse = pos;
    const g = gameRef.current;
    if (g.over) return;
    if (dragRef.current) {
      const d = dragRef.current;
      const back = -((pos.x - d.startX) * Math.cos(d.angle) + (pos.y - d.startY) * Math.sin(d.angle));
      d.power = Math.max(0, Math.min(MAX_POWER, back * (MAX_POWER / 220)));
      return;
    }
    if (shootingRef.current || pendingShotRef.current || g.ballInHand) return;
    const cue = getCueBall(g.balls);
    if (cue && !cue.pocketed) {
      aimRef.current.angle = Math.atan2(pos.y - cue.y, pos.x - cue.x);
    }
  }, []);

  const handlePointerDown = useCallback((e) => {
    ensureAudio();
    const pos = toTable(e);
    const g = gameRef.current;
    if (g.over) return;
    if (g.ballInHand) {
      if (canPlaceCueBall(g.balls, pos.x, pos.y)) {
        placeCueBall(getCueBall(g.balls), pos.x, pos.y);
        g.ballInHand = false;
        g.message = `Cue ball placed. ${PLAYER_NAMES[g.turn]} to shoot — target: ${formatBall(lowestRemaining(g.balls))}.`;
        syncUi();
      }
      return;
    }
    if (shootingRef.current || pendingShotRef.current) return;
    const cue = getCueBall(g.balls);
    if (!cue || cue.pocketed) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: pos.x, startY: pos.y, angle: aimRef.current.angle, power: 0 };
  }, [ensureAudio, syncUi]);

  const handlePointerUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.power >= MIN_POWER) {
      powerRef.current = d.power;
      setPowerState(Math.round(d.power));
      startShot(d.power);
    }
  }, [startShot]);

  const handleWheel = useCallback((e) => {
    const g = gameRef.current;
    if (shootingRef.current || g.ballInHand || g.over) return;
    e.preventDefault();
    const next = Math.min(MAX_POWER, Math.max(MIN_POWER, powerRef.current + (e.deltaY > 0 ? -2 : 2)));
    powerRef.current = next;
    setPowerState(Math.round(next));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        ensureAudio();
        startShot(powerRef.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ensureAudio, startShot]);

  const onPowerChange = useCallback((e) => {
    const v = Number(e.target.value);
    powerRef.current = v;
    setPowerState(v);
  }, []);

  const handleSpinClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    let y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    const mag = Math.hypot(x, y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    spinRef.current = { x, y };
    setSpin({ x, y });
  }, []);

  return (
    <div className="pool-game">
      <header className="game-header">
        <h1>9-Ball Pool</h1>
        <div className="scoreboard">
          {PLAYER_NAMES.map((name, i) => (
            <div
              key={name}
              className={`player ${!ui.over && ui.turn === i ? 'active' : ''} ${ui.winner === i ? 'won' : ''}`}
            >
              <span className="player-name">{name}</span>
              <span className="player-wins">{ui.wins[i]}</span>
            </div>
          ))}
          {!ui.over && <span className="target-chip">Target: {ui.target}-ball</span>}
        </div>
      </header>

      <p className="message" role="status" aria-live="polite">{ui.message}</p>

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className={ui.ballInHand ? 'placing' : ''}
        />
        {ui.ballInHand && !ui.over && (
          <div className="placing-hint">Ball in hand — click the table to place the cue ball</div>
        )}
        {ui.over && (
          <div className="winner-overlay">
            <div className="winner-card">
              <h2>{PLAYER_NAMES[ui.winner]} wins the rack! 🎱</h2>
              <button onClick={newRack}>Next Rack</button>
            </div>
          </div>
        )}
      </div>

      <div className="ball-tray" aria-label="Balls remaining">
        {BALLS.map(b => (
          <span
            key={b.number}
            className={`tray-ball ${ui.pocketedNumbers.includes(b.number) ? 'potted' : ''} ${b.stripe ? 'stripe' : ''}`}
            style={{ '--ball-color': b.color }}
          >
            {b.number}
          </span>
        ))}
      </div>

      <div className="controls">
        <div className="power-row">
          <label htmlFor="power">Power {Math.round(power)}</label>
          <input
            id="power"
            type="range"
            min={MIN_POWER}
            max={MAX_POWER}
            step={1}
            value={power}
            onChange={onPowerChange}
            disabled={ui.ballInHand || ui.over || ui.busy}
          />
          <button
            className="shoot-btn"
            onClick={() => { ensureAudio(); startShot(powerRef.current); }}
            disabled={ui.ballInHand || ui.over || ui.busy}
          >
            Shoot <kbd>Space</kbd>
          </button>
          <div className="spin-control" title="Cue ball spin: top = follow, bottom = draw, sides = english">
            <span>Spin</span>
            <div className="spin-pad" onPointerDown={handleSpinClick}>
              <div
                className="spin-dot"
                style={{ left: `${50 + spin.x * 38}%`, top: `${50 + spin.y * 38}%` }}
              />
            </div>
          </div>
          <button className="reset-btn" onClick={newRack}>New Rack</button>
        </div>
        <p className="hint">
          Move the mouse to aim, then click-drag backwards and release to shoot — or use the power
          slider and press Space. Scroll to fine-tune power. Click the spin pad to add english,
          follow, or draw.
        </p>
      </div>
    </div>
  );
}
