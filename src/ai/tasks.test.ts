import { describe, expect, it } from 'vitest';
import { taskSettings } from './tasks';

describe('taskSettings', () => {
  it('is the built-in settings with what the user overrides', () => {
    const built = taskSettings({ ai: {}, quickButtons: [] }, 'product');
    expect(built.model).toBeTruthy();
    const own = taskSettings(
      { ai: { product: { model: 'gemini-x', temperature: null } }, quickButtons: [] },
      'product',
    );
    expect(own).toEqual({ ...built, model: 'gemini-x', temperature: null });
    expect(
      taskSettings(
        { ai: { product: { thinking: 'off', temperature: 0.5 } }, quickButtons: [] },
        'product',
      ),
    ).toEqual({ ...built, thinking: 'off', temperature: 0.5 });
  });
});
