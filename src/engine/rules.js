// 9-ball rules: always strike the lowest-numbered ball first. Any ball may be
// pocketed off a legal hit. Fouls give the opponent ball in hand. Pocketing
// the 9 on a legal shot wins the rack; on a foul it is respotted.

export function lowestRemaining(balls) {
  let lowest = null;
  for (const b of balls) {
    if (b.number === 0 || b.pocketed || b.sinking) continue;
    if (!lowest || b.number < lowest.number) lowest = b;
  }
  return lowest ? lowest.number : 9;
}

export function evaluateShot({ cueScratched, firstHit, targetNumber, pocketed, railAfterContact }) {
  if (!firstHit) {
    return { legal: false, foul: 'the cue ball never touched another ball' };
  }
  if (firstHit.number !== targetNumber) {
    return {
      legal: false,
      foul: `wrong ball first — the ${targetNumber}-ball must be struck first, but the ${firstHit.number}-ball was hit`,
    };
  }
  if (cueScratched) {
    return { legal: false, foul: 'scratch — the cue ball was pocketed' };
  }
  if (pocketed.length === 0 && !railAfterContact) {
    return { legal: false, foul: 'no ball was pocketed and none reached a cushion after contact' };
  }
  return { legal: true, foul: null };
}

export function formatBall(number) {
  return number === 0 ? 'cue ball' : `${number}-ball`;
}
