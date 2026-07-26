export const TABLE_WIDTH = 1200;
export const TABLE_HEIGHT = 600;
export const RAIL = 40;
export const BALL_RADIUS = 12;
export const FRICTION = 0.9855;
export const STOP_SPEED = 0.08;
export const CUSHION_RESTITUTION = 0.72;
export const BALL_RESTITUTION = 0.93;
export const MAX_POWER = 60;
export const MIN_POWER = 2;
export const SHOT_POWER_SCALE = 0.45;
export const AIM_LINE_LENGTH = 420;

// Kitchen line (break placement) and rack apex spot
export const HEAD_STRING_X = RAIL + (TABLE_WIDTH - RAIL * 2) * 0.25;
export const FOOT_SPOT = { x: RAIL + (TABLE_WIDTH - RAIL * 2) * 0.75, y: TABLE_HEIGHT / 2 };

export const POCKET_RADIUS = 24;
export const POCKET_CAPTURE = 19;
export const POCKETS = [
  { x: RAIL + 2, y: RAIL + 2 },
  { x: TABLE_WIDTH / 2, y: RAIL - 8 },
  { x: TABLE_WIDTH - RAIL - 2, y: RAIL + 2 },
  { x: RAIL + 2, y: TABLE_HEIGHT - RAIL - 2 },
  { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - RAIL + 8 },
  { x: TABLE_WIDTH - RAIL - 2, y: TABLE_HEIGHT - RAIL - 2 },
];

export const BALLS = [
  { number: 1, color: '#f6c437', stripe: false },
  { number: 2, color: '#2563eb', stripe: false },
  { number: 3, color: '#ef4444', stripe: false },
  { number: 4, color: '#7c3aed', stripe: false },
  { number: 5, color: '#f97316', stripe: false },
  { number: 6, color: '#15803d', stripe: false },
  { number: 7, color: '#8b1a1a', stripe: false },
  { number: 8, color: '#1f2430', stripe: false },
  { number: 9, color: '#f6c437', stripe: true },
];
