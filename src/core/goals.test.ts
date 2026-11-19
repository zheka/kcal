import { describe, expect, it } from 'vitest';
import { goalSetOn, goalsOn, saveGoals } from './goals';
import type { GoalSet } from './types';

// Europe/Berlin: 2026-11-01T18:20Z is 19:20 local, 2027-01-14T23:30Z is 00:30 on Jan 15.
const goals: GoalSet[] = [
  { perDay: { kcal: 2000, protein: 150 }, setAt: '2026-11-01T18:20:05.114Z' },
  { perDay: { kcal: 2200, protein: 160, water: 2000 }, setAt: '2027-01-14T23:30:00.000Z' },
];

describe('goals on a day', () => {
  it('apply from the start of the local day they were saved on', () => {
    expect(goalsOn(goals, '2026-10-31')).toBeNull();
    // saved in the evening, but valid for the whole day
    expect(goalsOn(goals, '2026-11-01')?.kcal).toBe(2000);
    expect(goalsOn(goals, '2027-01-14')?.kcal).toBe(2000);
    // 23:30 UTC on Jan 14 is already Jan 15 locally
    expect(goalsOn(goals, '2027-01-15')?.water).toBe(2000);
    expect(goalSetOn(goals, '2030-01-01')).toBe(goals[1]);
  });

  it('are none after a set without perDay', () => {
    const cleared = [...goals, { setAt: '2027-03-01T10:00:00.000Z' }];
    expect(goalsOn(cleared, '2027-03-01')).toBeNull();
    expect(goalsOn(cleared, '2027-02-28')?.kcal).toBe(2200);
  });
});

describe('saving goals', () => {
  it('adds a set at now; earlier days keep their goals', () => {
    const now = new Date('2027-03-01T14:00:00.000Z');
    const saved = saveGoals(goals, { kcal: 1900 }, now);
    expect(saved.at(-1)).toEqual({ perDay: { kcal: 1900 }, setAt: '2027-03-01T14:00:00.000Z' });
    expect(goalsOn(saved, '2027-02-28')?.kcal).toBe(2200);
    expect(goalsOn(saved, '2027-03-01')?.kcal).toBe(1900);
  });

  it('replaces a set saved earlier the same local day', () => {
    const morning = saveGoals(goals, { kcal: 1900 }, new Date('2027-03-01T07:00:00.000Z'));
    const evening = saveGoals(morning, { kcal: 1800 }, new Date('2027-03-01T20:00:00.000Z'));
    expect(evening).toHaveLength(3);
    expect(evening.at(-1)?.perDay).toEqual({ kcal: 1800 });
  });

  it('changes nothing for the same targets, and stores no perDay for no goals', () => {
    const now = new Date('2027-03-01T14:00:00.000Z');
    expect(saveGoals(goals, { kcal: 2200, protein: 160, water: 2000 }, now)).toEqual(goals);
    expect(saveGoals([], {}, now)).toEqual([]);
    expect(saveGoals(goals, {}, now).at(-1)).toEqual({ setAt: '2027-03-01T14:00:00.000Z' });
  });
});
