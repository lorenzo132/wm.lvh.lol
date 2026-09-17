export function validDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// datetime-local expects local wall time, whereas persisted timestamps use UTC.
export function toLocalDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : validDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function toStoredDate(value: string): string {
  return validDate(value)?.toISOString() || '';
}
