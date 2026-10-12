import { Pipe, PipeTransform } from '@angular/core';

/**
 * Rupees with Indian digit grouping (₹1,23,456) — whole rupees without decimals, any paise kept
 * to two places (₹1,234.50). Display only: values are never rounded away or re-priced.
 */
export function formatInr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const whole = Math.abs(value - Math.round(value)) < 1e-9;
  return '₹' + value.toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

@Pipe({ name: 'inr', standalone: true, pure: true })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatInr(value);
  }
}
