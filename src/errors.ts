/** Supabase errors are often plain objects, not instances of Error. */
export function fieldErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('message' in error)
    || typeof error.message !== 'string' || !error.message.trim()) return fallback;

  const code = 'code' in error ? error.code : null;
  if ((code === '42703' || code === 'PGRST204') && error.message.includes('visit_status')) {
    return 'Visit status is not set up in the database yet. Run delta-08-field-map-planned-visits.sql in the Supabase SQL editor, then try saving again.';
  }
  return error.message;
}
