const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;

export function isQuietHour(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function canQueueWarAlert(
  existingAlertTimes: number[],
  now: number,
  maxWarAlertsPerDay: number,
): boolean {
  if (maxWarAlertsPerDay <= 0) return false;
  const recentCount = existingAlertTimes.filter(
    (createdAt) => createdAt > now - DAY_MILLISECONDS && createdAt <= now,
  ).length;
  return recentCount < maxWarAlertsPerDay;
}
