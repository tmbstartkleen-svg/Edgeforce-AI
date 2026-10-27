export const USER_TIME_ZONE = 'America/New_York';

export function easternDay(iso: string | Date) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: USER_TIME_ZONE });
}

export function easternPeriod(iso: string) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: USER_TIME_ZONE,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(new Date(iso)));
  if (hour < 5 || hour >= 23) return 'Overnight';
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}
