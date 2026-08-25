export const BETA_OPERATIONS = {
  controllerName: 'Davut Emre',
  consentVersion: 'closed-beta-2026-08-25-v1',
  realMoney: false,
  minimumAge: 18,
  supportRoute: '/api/beta/request',
  normalReviewHours: 24,
  urgentReviewHours: 1,
  appealReviewHours: 72,
} as const;

export const FOCUS_PROVINCES = [
  { code: '28', name: 'Madrid', front: 1 },
  { code: '45', name: 'Toledo', front: 1 },
  { code: '01', name: 'Araba/Álava', front: 2 },
  { code: '09', name: 'Burgos', front: 2 },
  { code: '11', name: 'Cádiz', front: 3 },
  { code: '29', name: 'Málaga', front: 3 },
] as const;

export const FOCUS_FRONTS = [
  ['28', '45'],
  ['01', '09'],
  ['11', '29'],
] as const;
