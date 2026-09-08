/** Supabase errors are often plain objects, not instances of Error. */
export function fieldErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('message' in error)
    || typeof error.message !== 'string' || !error.message.trim()) return fallback;

  const code = 'code' in error ? error.code : null;
  if ((code === '42703' || code === 'PGRST204') && error.message.includes('google_maps_url')) {
    return 'Saved Google Maps links need database setup. Run migrations/11-pin-google-maps-link.sql in the Supabase SQL editor, then retry.';
  }
  if (['42P01', 'PGRST205', '42703', 'PGRST204'].includes(String(code)) && /field_tags|tags/.test(error.message)) {
    return 'Pin tags needs database setup. Run migrations/10-pin-tags.sql in the Supabase SQL editor, then retry.';
  }
  if ((code === '42P01' || code === 'PGRST205') && error.message.includes('field_general_notes')) {
    return 'General notes needs database setup. Run migrations/09-general-notes.sql in the Supabase SQL editor, then retry.';
  }
  if ((code === '42703' || code === 'PGRST204') && error.message.includes('visit_status')) {
    return 'Visit status is not set up in the database yet. Run delta-08-field-map-planned-visits.sql in the Supabase SQL editor, then try saving again.';
  }
  return error.message;
}
