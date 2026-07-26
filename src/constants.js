export const TABLE_WIDTH = 1200;
export const TABLE_HEIGHT = 600;
export const RAIL = 40;
export const BALL_RADIUS = 12;
export const CUE_BALL_MASS = 1;
export const OBJECT_BALL_MASS = 1;
export const FRICTION = 0.984;
export const STOP_SPEED = 0.12;
export const MAX_POWER = 60;
export const MIN_POWER = 1;
export const AIM_LINE_LENGTH = 500;
export const SHOT_POWER_SCALE = 0.6;

// Ball colors and numbers
export const BALLS = [
  { number: 1, color: '#f4d03f' },   // yellow
  { number: 2, color: '#2e86de' },   // blue
  { number: 3, color: '#e74c3c' },   // red
  { number: 4, color: '#8e44ad' },   // purple
  { number: 5, color: '#f39c12' },   // orange
  { number: 6, color: '#27ae60' },   // green
  { number: 7, color: '#c0392b' },   // maroon
  { number: 8, color: '#2c3e50' },   // black
  { number: 9, color: '#f1c40f' },   // yellow stripe
];

// Pockets positions
export const POCKET_RADIUS = 22;
export const POCKETS = [
  { x: RAIL, y: RAIL },
  { x: TABLE_WIDTH / 2, y: RAIL - 5 },
  { x: TABLE_WIDTH - RAIL, y: RAIL },
  { x: RAIL, y: TABLE_HEIGHT - RAIL },
  { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - RAIL + 5 },
  { x: TABLE_WIDTH - RAIL, y: TABLE_HEIGHT - RAIL },
];
