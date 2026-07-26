import { BALLS } from '../constants';

export function nineBallHitOrder() {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9];
}

export function currentTarget(nextTargetIndex) {
  const order = nineBallHitOrder();
  return order[nextTargetIndex] || 9;
}

export function findCueBall(balls) {
  return balls.find(b => b.number === 0);
}

export function findFirstHit(balls, pocketedThisShot, cueBall) {
  // We can't detect first hit exactly from state, so pass it from collision event.
  return null;
}

export function isLegalShot(cueBall, firstObjectHit, targetNumber, pocketedThisShot) {
  if (!firstObjectHit) {
    // Cue ball did not hit any object ball → foul
    return { legal: false, foul: 'No object ball hit' };
  }
  if (firstObjectHit.number !== targetNumber) {
    return { legal: false, foul: `Wrong ball first. Target was ${targetNumber}, hit ${firstObjectHit.number}` };
  }
  // Legal hit. It doesn't have to pocket a ball.
  return { legal: true, foul: null };
}

export function checkScratch(cueBall) {
  return cueBall.pocketed;
}

export function isGameWon(balls) {
  const nine = balls.find(b => b.number === 9);
  return nine?.pocketed;
}

export function nextTargetAfterPocket(targetIndex, pocketedBalls) {
  const order = nineBallHitOrder();
  let newIndex = targetIndex;
  while (newIndex < order.length) {
    const num = order[newIndex];
    if (pocketedBalls.some(b => b.number === num)) {
      newIndex++;
    } else {
      break;
    }
  }
  return newIndex;
}

export function formatBall(number) {
  if (number === 0) return 'Cue';
  return `${number}-ball`;
}

export function isRackResetNeeded(balls) {
  return balls.some(b => b.pocketed) === false;
}
