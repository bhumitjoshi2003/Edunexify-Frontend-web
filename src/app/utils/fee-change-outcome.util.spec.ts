import { summarizeFeeChange } from './fee-change-outcome.util';
import { FeeWorkflowChangeResult } from '../interfaces/fee-workflow';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('summarizeFeeChange', () => {
  const result = (saved: boolean[], recalculatedMonths = 3, skippedMonths = 1, message = 'Fee head is inactive'): FeeWorkflowChangeResult => ({
    requestedStudents: saved.length,
    savedStudents: saved.filter(Boolean).length,
    recalculatedMonths,
    skippedMonths,
    students: saved.map((ok, i) => ({ studentId: `S${i + 1}`, changeSaved: ok, months: [], message: ok ? undefined : message })),
  });

  it('all saved: Completed, with what changed', () => {
    const outcome = summarizeFeeChange(result([true, true]), 'Discount saved.');
    expect(outcome.kind).toBe('all-saved');
    expect(outcome.level).toBe('success');
    expect(outcome.title).toBe('Completed');
    expect(outcome.message).toBe('Discount saved. 3 month(s) updated; 1 month(s) left unchanged because they were protected or ineligible.');
  });

  it('partial: says how many were saved and why the others were not — never Completed', () => {
    const outcome = summarizeFeeChange(result([true, false, true]), 'Discount saved.');
    expect(outcome.kind).toBe('partial');
    expect(outcome.level).toBe('warning');
    expect(outcome.title).not.toContain('Completed');
    expect(outcome.message).toContain('2 of 3 student(s) updated; 1 not saved: Fee head is inactive');
  });

  it('none saved: an error with the server reason — never Completed', () => {
    const outcome = summarizeFeeChange(result([false, false]), 'Discount saved.');
    expect(outcome.kind).toBe('none-saved');
    expect(outcome.level).toBe('error');
    expect(outcome.title).toBe('Nothing was saved');
    expect(outcome.message).toBe('Fee head is inactive');
  });

  it('an empty result saved nothing', () => {
    const outcome = summarizeFeeChange({ requestedStudents: 0, savedStudents: 0, recalculatedMonths: 0, skippedMonths: 0, students: [] }, 'x');
    expect(outcome.kind).toBe('none-saved');
    expect(outcome.message).toBe('No students were updated. Please review and try again.');
  });

  it('saved, but every affected month was protected: says nothing was recalculated', () => {
    const outcome = summarizeFeeChange(result([true], 0, 4), 'Transport updated.');
    expect(outcome.kind).toBe('saved-none-changed');
    expect(outcome.level).toBe('info');
    expect(outcome.message).toContain('All 4 affected month(s) were left unchanged');
  });
});
