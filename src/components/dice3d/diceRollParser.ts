export function extractDiceRolls(
  formula: string,
  result: number,
  detail?: string,
): Array<{ sides: number; result: number }> {
  const dice: Array<{ sides: number; result: number }> = [];

  const bracketMatches = detail ? [...detail.matchAll(/\[([0-9,\s]+)\]/g)] : [];
  const diceMatches = [...formula.matchAll(/(\d+)d(\d+)/gi)];

  if (bracketMatches.length > 0 && diceMatches.length > 0) {
    let bracketIdx = 0;
    for (const dMatch of diceMatches) {
      const count = parseInt(dMatch[1], 10);
      const sides = parseInt(dMatch[2], 10);

      const brText = bracketMatches[bracketIdx] ? bracketMatches[bracketIdx][1] : "";
      bracketIdx++;

      const nums = brText
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      for (let i = 0; i < count; i++) {
        const faceVal = nums[i] ?? Math.min(Math.max(1, result), sides);
        dice.push({ sides, result: faceVal });
      }
    }
  } else if (diceMatches.length > 0) {
    for (const dMatch of diceMatches) {
      const count = parseInt(dMatch[1], 10);
      const sides = parseInt(dMatch[2], 10);
      for (let i = 0; i < count; i++) {
        const faceVal = Math.min(Math.max(1, result), sides);
        dice.push({ sides, result: faceVal });
      }
    }
  } else {
    const sides = 20;
    const faceVal = Math.min(Math.max(1, result), sides);
    dice.push({ sides, result: faceVal });
  }

  return dice;
}
