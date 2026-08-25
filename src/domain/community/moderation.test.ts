import { describe, expect, it } from 'vitest';
import {
  classifyReport,
  sanitizeReportDetails,
  translateAnnouncement,
} from './moderation';

describe('community moderation', () => {
  it('redacts links, email addresses, phone numbers, and invisible characters', () => {
    const result = sanitizeReportDetails(
      'Mira https://bad.example/x, escribe a victim@example.com o llama +34 612 345 678\u200B.',
    );

    expect(result).not.toContain('bad.example');
    expect(result).not.toContain('victim@example.com');
    expect(result).not.toContain('612 345 678');
    expect(result).not.toContain('\u200B');
    expect(result).toContain('[enlace oculto]');
    expect(result).toContain('[dato personal oculto]');
  });

  it('returns null for empty details and clamps stored text to 500 characters', () => {
    expect(sanitizeReportDetails('  \n  ')).toBeNull();
    expect(sanitizeReportDetails('a'.repeat(900))?.length).toBe(500);
  });

  it('routes safety-critical reports to urgent human review without an LLM verdict', () => {
    expect(classifyReport('threat')).toEqual({
      queue: 'urgent-human-review',
      decision: 'REVIEW',
      ruleCodes: ['SAFETY_THREAT'],
    });
    expect(classifyReport('political-propaganda')).toMatchObject({
      queue: 'standard-human-review',
      decision: 'REVIEW',
    });
  });

  it('translates the fixed announcement vocabulary in Spanish and English', () => {
    expect(translateAnnouncement('SUPPLY_NEEDED', 'es')).toBe('Necesitamos suministros');
    expect(translateAnnouncement('SUPPLY_NEEDED', 'en')).toBe('Supplies needed');
  });
});
