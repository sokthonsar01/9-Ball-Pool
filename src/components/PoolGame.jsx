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
  AIM_LINE_LENGTH,
  SHOT_POWER_SCALE,
} from '../constants';
import {
  rackBalls,
  moveBalls,
  resolveCushionCollisions,
  resolveBallCollisions,
  checkPockets,
  allBallsStopped,
  placeCueBall,
  getCueBall,
} from '../engine/physics';
import {
  currentTarget,
  isLegalShot,
  checkScratch,
  isGameWon,
  nextTargetAfterPocket,
  formatBall,
} from '../engine/rules';
import './PoolGame.css';

const SCALE = 0.9;

function drawTable(ctx) {
  const w = TABLE_WIDTH * SCALE;
  const h = TABLE_HEIGHT * SCALE;
  ctx.fillStyle = '#2a5d3a';
  ctx.fillRect(0, 0, w, h);
  // Rails
  ctx.lineWidth = RAIL * SCALE;
  ctx.strokeStyle = '#4a3b2a';
  ctx.strokeRect((RAIL * SCALE) / 2, (RAIL * SCALE) / 2, w - RAIL * SCALE, h - RAIL * SCALE);
  // Inner line
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#d4af37';
  ctx.strokeRect(RAIL * SCALE, RAIL * SCALE, w - RAIL * SCALE * 2, h - RAIL * SCALE * 2);
  // Pockets
  for (const p of POCKETS) {
    ctx.beginPath();
    ctx.arc(p.x * SCALE, p.y * SCALE, POCKET_RADIUS * SCALE, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawBalls(ctx, balls) {
  for (const ball of balls) {
    if (ball.pocketed) continue;
    const x = ball.x * SCALE;
    const y = ball.y * SCALE;
    const r = BALL_RADIUS * SCALE;
    drawBall3D(ctx, ball, x, y, r);
  }
}

function drawBall3D(ctx, ball, x, y, r) {
  // Drop shadow
  ctx.beginPath();
  ctx.ellipse(x + r * 0.25, y + r * 0.35, r * 0.9, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  // Main sphere body with radial 3D shading
  const grad = ctx.createRadialGradient(
    x - r * 0.35, y - r * 0.4, r * 0.15,
    x, y, r
  );
  grad.addColorStop(0, lighten(ball.color, 60));
  grad.addColorStop(0.3, ball.color);
  grad.addColorStop(0.85, darken(ball.color, 25));
  grad.addColorStop(1, darken(ball.color, 50));

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Specular highlight
  ctx.beginPath();
  ctx.arc(x - r * 0.32, y - r * 0.42, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();

  // Small rim shadow
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // White number circle for striped balls
  if (ball.number === 9 || ball.number === 0) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = '#f9fafb';
    ctx.fill();
  }

  // Number
  if (ball.number > 0) {
    ctx.fillStyle = '#000';
    ctx.font = `bold ${Math.max(8, r * 0.8)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ball.number, x, y + 1);
  }
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function lighten(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 + percent / 100;
  return rgbToHex(r * factor, g * factor, b * factor);
}

function darken(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 - percent / 100;
  return rgbToHex(r * factor, g * factor, b * factor);
}

function drawAim(ctx, cueBall, aimAngle, power) {
  if (!cueBall || cueBall.pocketed) return;
  const x = cueBall.x * SCALE;
  const y = cueBall.y * SCALE;
  const dirX = Math.cos(aimAngle);
  const dirY = Math.sin(aimAngle);
  const aimLen = AIM_LINE_LENGTH;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dirX * aimLen * SCALE, y + dirY * aimLen * SCALE);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  // power indicator circle at cue ball
  ctx.beginPath();
  ctx.arc(x, y, 6 + (power / MAX_POWER) * 16, 0, Math.PI * 2);
  ctx.strokeStyle = `hsl(${(1 - power / MAX_POWER) * 120}, 90%, 50%)`;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function angleBetween(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function screenToTable(sx, sy, rect) {
  const canvasX = sx - rect.left;
  const canvasY = sy - rect.top;
  return { x: canvasX / SCALE, y: canvasY / SCALE };
}

export default function PoolGame() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const ballsRef = useRef(rackBalls());
  const [targetIndex, setTargetIndex] = useState(0);
  const [message, setMessage] = useState('Aim with mouse, then adjust power with the slider or mouse wheel. Click Shoot or press Space.');
  const [gameOver, setGameOver] = useState(false);
  const [balls, setBalls] = useState(ballsRef.current);
  const [placingCue, setPlacingCue] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [aimAngle, setAimAngle] = useState(0);
  const [power, setPower] = useState(12);
  const [fouls, setFouls] = useState([]);
  const firstHitRef = useRef(null);
  const pocketedThisShotRef = useRef([]);
  const [isShooting, setIsShooting] = useState(false);

  const resetGame = useCallback(() => {
    ballsRef.current = rackBalls();
    setBalls(ballsRef.current);
    setTargetIndex(0);
    setGameOver(false);
    setPlacingCue(false);
    setFouls([]);
    setPower(12);
    setAimAngle(0);
    setMessage('New game! Aim with mouse, adjust power, then shoot.');
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTable(ctx);
    drawBalls(ctx, ballsRef.current);
    const cue = getCueBall(ballsRef.current);
    if (!isShooting && cue && !cue.pocketed && allBallsStopped(ballsRef.current)) {
      drawAim(ctx, cue, aimAngle, power);
    }
  }, [aimAngle, power, isShooting]);

  const endShot = useCallback(() => {
    const currentBalls = ballsRef.current;
    const cue = getCueBall(currentBalls);
    const targetNum = currentTarget(targetIndex);
    let shotMessage = '';
    let isFoul = false;

    if (checkScratch(cue)) {
      isFoul = true;
      shotMessage = 'Foul! Cue ball pocketed (scratch).';
    } else {
      const result = isLegalShot(cue, firstHitRef.current, targetNum, pocketedThisShotRef.current);
      if (!result.legal) {
        isFoul = true;
        shotMessage = `Foul! ${result.foul}.`;
      } else {
        shotMessage = 'Good shot.';
      }
    }

    const pocketedOrder = [...pocketedThisShotRef.current].sort((a, b) => a.number - b.number);
    if (pocketedOrder.length > 0) {
      shotMessage += ` Potted: ${pocketedOrder.map(b => formatBall(b.number)).join(', ')}.`;
    }

    if (isGameWon(currentBalls)) {
      setGameOver(true);
      setMessage('You win! 9-ball pocketed. Great game.');
      return;
    }

    if (isFoul) {
      setFouls(f => [...f, shotMessage]);
      setMessage(shotMessage + ' Click anywhere on the table to place cue ball.');
      setPlacingCue(true);
      return;
    }

    const newIndex = nextTargetAfterPocket(targetIndex, currentBalls.filter(b => b.pocketed));
    setTargetIndex(newIndex);
    const nextTarget = currentTarget(newIndex);
    setMessage(`${shotMessage} Next target: ${formatBall(nextTarget)}.`);
  }, [targetIndex]);

  const step = useCallback(() => {
    const currentBalls = ballsRef.current;
    moveBalls(currentBalls);
    resolveCushionCollisions(currentBalls, TABLE_WIDTH, TABLE_HEIGHT, RAIL);
    // Track first object ball hit by cue ball for rules
    const cue = getCueBall(currentBalls);
    if (cue && !cue.pocketed) {
      for (const b of currentBalls) {
        if (b.number === 0 || b.pocketed) continue;
        const dx = b.x - cue.x;
        const dy = b.y - cue.y;
        const dist = Math.hypot(dx, dy);
        if (dist < BALL_RADIUS * 2 && !firstHitRef.current) {
          const separating = (b.vx - cue.vx) * dx + (b.vy - cue.vy) * dy > 0;
          if (!separating) {
            firstHitRef.current = b;
          }
        }
      }
    }
    resolveBallCollisions(currentBalls);
    const pocketed = checkPockets(currentBalls);
    if (pocketed.length > 0) {
      for (const p of pocketed) {
        if (!pocketedThisShotRef.current.includes(p)) {
          pocketedThisShotRef.current.push(p);
        }
      }
    }
    setBalls([...currentBalls]);

    if (allBallsStopped(currentBalls)) {
      setIsShooting(false);
      cancelAnimationFrame(animationRef.current);
      endShot();
      return;
    }
    animationRef.current = requestAnimationFrame(step);
  }, [endShot]);

  const shoot = useCallback(() => {
    const cue = getCueBall(ballsRef.current);
    if (!cue || cue.pocketed || isShooting) return;
    cue.vx = Math.cos(aimAngle) * power * SHOT_POWER_SCALE;
    cue.vy = Math.sin(aimAngle) * power * SHOT_POWER_SCALE;
    firstHitRef.current = null;
    pocketedThisShotRef.current = [];
    setIsShooting(true);
    animationRef.current = requestAnimationFrame(step);
  }, [aimAngle, power, isShooting, step]);

  const handleMouseMove = useCallback(
    (e) => {
      if (isShooting || placingCue) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const pos = screenToTable(e.clientX, e.clientY, rect);
      setMouse(pos);
      const cue = getCueBall(ballsRef.current);
      if (cue && !cue.pocketed) {
        setAimAngle(angleBetween(cue, pos));
      }
    },
    [isShooting, placingCue]
  );

  const handleMouseDown = useCallback(
    (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const pos = screenToTable(e.clientX, e.clientY, rect);
      if (placingCue) {
        const cue = getCueBall(ballsRef.current);
        if (cue) {
          placeCueBall(cue, pos.x, pos.y);
          setPlacingCue(false);
          setBalls([...ballsRef.current]);
          setMessage('Cue ball placed. Continue shooting.');
        }
        return;
      }
    },
    [placingCue]
  );

  const handleWheel = useCallback(
    (e) => {
      if (isShooting || placingCue) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      setPower(p => Math.min(Math.max(p + delta, MIN_POWER), MAX_POWER));
    },
    [isShooting, placingCue]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        shoot();
      }
    },
    [shoot]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const onPowerChange = useCallback((e) => {
    setPower(Number(e.target.value));
  }, []);

  useEffect(() => {
    draw();
  }, [draw, balls, mouse, power, aimAngle, isShooting]);

  return (
    <div className="pool-game">
      <header className="game-header">
        <h1>9-Ball Pool</h1>
        <div className="status">
          {<>
            {!gameOver && (
              <span className="target">
                Target: {formatBall(currentTarget(targetIndex))}
              </span>
            )}
            <button className="reset-btn" onClick={resetGame}>New Rack</button>
          </>
          }
        </div>
      </header>
      <p className="message" role="status" aria-live="polite">{message}</p>
      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          width={TABLE_WIDTH * SCALE}
          height={TABLE_HEIGHT * SCALE}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          className={placingCue ? 'placing' : ''}
        />
        {placingCue && <div className="placing-hint">Click table to place cue ball</div>}
      </div>
      <div className="controls">
        <div className="power-row">
          <label htmlFor="power">Power: {power.toFixed(1)}</label>
          <input
            id="power"
            type="range"
            min={MIN_POWER}
            max={MAX_POWER}
            step={0.5}
            value={power}
            onChange={onPowerChange}
            disabled={isShooting || placingCue}
          />
          <button className="shoot-btn" onClick={shoot} disabled={isShooting || placingCue || gameOver}>
            Shoot (Space)
          </button>
        </div>
        <p className="hint">Move mouse to aim. Use slider or scroll wheel to change power. Press Space or click Shoot.</p>
        <div className="power-bar">
          <div className="power-fill" style={{ width: `${(power / MAX_POWER) * 100}%` }} />
        </div>
      </div>
      {fouls.length > 0 && (
        <div className="fouls">
          <h3>Fouls</h3>
          <ul>
            {fouls.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
