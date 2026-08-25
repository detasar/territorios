export const ANNOUNCEMENT_MESSAGES = {
  DEFEND_HERE: { es: 'Defended aquí', en: 'Defend here' },
  SUPPLY_NEEDED: { es: 'Necesitamos suministros', en: 'Supplies needed' },
  TARGET_CONFIRMED: { es: 'Objetivo confirmado', en: 'Target confirmed' },
  HOLD_POSITION: { es: 'Mantened la posición', en: 'Hold position' },
  THANK_YOU_DEFENDERS: { es: 'Gracias, defensores', en: 'Thank you, defenders' },
} as const;

export type AnnouncementKey = keyof typeof ANNOUNCEMENT_MESSAGES;
export type SupportedLocale = 'es' | 'en';

const reportRules = {
  'illegal-content': ['ILLEGAL_CONTENT'],
  'hate-harassment': ['HATE_OR_HARASSMENT'],
  threat: ['SAFETY_THREAT'],
  'personal-information': ['PERSONAL_INFORMATION'],
  'fraud-impersonation': ['FRAUD_OR_IMPERSONATION'],
  'political-propaganda': ['POLITICAL_PROPAGANDA'],
  other: ['COMMUNITY_RULES_OTHER'],
} as const;

export type ReportReason = keyof typeof reportRules;

export function sanitizeReportDetails(details: string | undefined): string | null {
  if (!details) return null;
  const normalized = details
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[dato personal oculto]')
    .replace(/(?:https?:\/\/|www\.)[^\s]+/gi, '[enlace oculto]')
    .replace(/(?:\+?34[\s.-]*)?(?:\d[\s.-]*){9}/g, '[dato personal oculto]')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? normalized.slice(0, 500) : null;
}

export function classifyReport(reason: ReportReason) {
  const urgent = ['illegal-content', 'threat', 'personal-information'].includes(reason);
  return {
    queue: urgent ? 'urgent-human-review' : 'standard-human-review',
    decision: 'REVIEW' as const,
    ruleCodes: [...reportRules[reason]],
  };
}

export function translateAnnouncement(key: AnnouncementKey, locale: SupportedLocale): string {
  return ANNOUNCEMENT_MESSAGES[key][locale];
}
