/**
 * Trip dates are local wall-clock times with no timezone, matching how the
 * backend stores `departure_at` (e.g. `2026-10-01T09:00:00`).
 */

export function toLocalDateTimeString(date: string, time: string) {
  return `${date}T${time}:00`;
}

// e.g. "Thu, 1 Oct 2026, 09:00"
export function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// e.g. "Thu, 1 Oct"
export function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// Last day of a trip that starts on `start` and lasts `durationDays`.
export function tripEndDate(start: Date, durationDays: number) {
  const end = new Date(start);
  end.setDate(end.getDate() + durationDays - 1);

  return end;
}

export function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}
