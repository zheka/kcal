import { describe, expect, it } from 'vitest';
import { goalsOn, saveGoals } from './goals';
import type { GoalSet } from './types';

const goals: GoalSet[] = [
  { from: '2026-11-01', targets: { kcal: 2000, protein: 150 } },
  { from: '2027-01-15', targets: { kcal: 2200, protein: 160 } },
];

describe('goalsOn', () => {
  it('is null before the first goals', () => {
    expect(goalsOn(goals, '2026-10-31')).toBeNull();
    expect(goalsOn([], '2026-11-17')).toBeNull();
  });

  it('gives the goals valid on a date, from their first day until the next set', () => {
    expect(goalsOn(goals, '2026-11-01')?.kcal).toBe(2000);
    expect(goalsOn(goals, '2027-01-14')?.kcal).toBe(2000);
    expect(goalsOn(goals, '2027-01-15')?.kcal).toBe(2200);
    expect(goalsOn(goals, '2030-01-01')?.kcal).toBe(2200);
  });
});

describe('saveGoals', () => {
  it('adds new goals effective from today, keeping the old ones for the past', () => {
    const saved = saveGoals(goals, { kcal: 1900, protein: 160 }, '2027-03-01');
    expect(saved).toHaveLength(3);
    expect(goalsOn(saved, '2027-02-28')?.kcal).toBe(2200);
    expect(goalsOn(saved, '2027-03-01')?.kcal).toBe(1900);
  });

  it('replaces goals saved earlier the same day', () => {
    const saved = saveGoals(goals, { kcal: 2100 }, '2027-01-15');
    expect(saved).toHaveLength(2);
    expect(saved[1]).toEqual({ from: '2027-01-15', targets: { kcal: 2100 } });
  });

  it('changes nothing when the targets are the same', () => {
    expect(saveGoals(goals, { protein: 160, kcal: 2200 }, '2027-03-01')).toEqual(goals);
    expect(saveGoals([], {}, '2027-03-01')).toEqual([]);
  });

  it('can remove a goal from today on', () => {
    const saved = saveGoals(goals, { kcal: 2200 }, '2027-03-01');
    expect(goalsOn(saved, '2027-03-01')).toEqual({ kcal: 2200 });
  });
});
