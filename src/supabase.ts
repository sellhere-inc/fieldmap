import { createClient } from '@supabase/supabase-js';
import type { CSSProperties } from 'react';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Copy fieldmap/.env.example to fieldmap/.env and fill in your Supabase keys.');
}

/**
 * The field map uses the same anon key as the mobile app and admin panel.
 *
 * That is safe because the `field_*` tables grant nothing to `anon` and every
 * policy is gated on `private.is_field_member()` — this key on its own cannot
 * read a single row. See supabase/delta-07-field-map.sql.
 */
export const supabase = createClient(url, anonKey);

/** Empty string when unset — the map shows a setup card instead of failing. */
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? '';

export type PlaceKind = 'farmer' | 'trader' | 'warehouse';

export const PLACE_KINDS: PlaceKind[] = ['farmer', 'trader', 'warehouse'];

export const KIND_LABEL: Record<PlaceKind, string> = {
  farmer: 'Farmer',
  trader: 'Trader',
  warehouse: 'Warehouse',
};

export const KIND_PLURAL: Record<PlaceKind, string> = {
  farmer: 'Farmers',
  trader: 'Traders',
  warehouse: 'Warehouses',
};

/**
 * Marker colours. Taken from the palette the marketing site already uses
 * (website/index.html `:root`) so the three products look related.
 */
export const KIND_COLOR: Record<PlaceKind, string> = {
  farmer: '#30d158',
  trader: '#0071e3',
  warehouse: '#ff9f0a',
};

/**
 * Pass CSS custom properties in a `style` prop. React forwards them fine at
 * runtime; only the type definition has no room for them.
 */
export function cssVars(vars: Record<`--${string}`, string>): CSSProperties {
  return vars as CSSProperties;
}

export interface FieldPlaceCrop {
  id: string;
  place_id: string;
  crop_name: string;
  /** Free text — real answers look like "~200 nuts per tree". Null when unknown. */
  avg_yield: string | null;
  sort_order: number;
}

export interface FieldPlace {
  id: string;
  kind: PlaceKind;
  name: string;
  remarks: string | null;
  latitude: number;
  longitude: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Embedded child rows. Always present for farmers, usually empty otherwise. */
  field_place_crops: FieldPlaceCrop[];
}

/** A crop row being edited, before it has an id. */
export interface CropDraft {
  crop_name: string;
  avg_yield: string;
}

export interface PlaceDraft {
  kind: PlaceKind;
  name: string;
  remarks: string;
  latitude: number;
  longitude: number;
  crops: CropDraft[];
}

/**
 * One query for the whole map. A few hundred points is small enough that
 * layer filtering and crop-name autocomplete both work off this list in
 * memory — no extra round trips.
 */
export async function fetchPlaces(): Promise<FieldPlace[]> {
  const { data, error } = await supabase
    .from('field_places')
    .select('*, field_place_crops(*)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as FieldPlace[];
}

/** Crop rows are only meaningful for farmers, and blank rows are dropped. */
function cleanCrops(draft: PlaceDraft): CropDraft[] {
  if (draft.kind !== 'farmer') return [];
  return draft.crops.filter((crop) => crop.crop_name.trim().length > 0);
}

async function replaceCrops(placeId: string, crops: CropDraft[]): Promise<void> {
  // Delete-then-insert rather than diffing. The lists are a handful of rows,
  // and the child table has no incoming references, so nothing can dangle.
  const { error: clearError } = await supabase
    .from('field_place_crops')
    .delete()
    .eq('place_id', placeId);
  if (clearError) throw clearError;

  if (crops.length === 0) return;

  const { error: insertError } = await supabase.from('field_place_crops').insert(
    crops.map((crop, index) => ({
      place_id: placeId,
      crop_name: crop.crop_name.trim(),
      avg_yield: crop.avg_yield.trim() || null,
      sort_order: index,
    }))
  );
  if (insertError) throw insertError;
}

export async function createPlace(draft: PlaceDraft): Promise<void> {
  const { data, error } = await supabase
    .from('field_places')
    .insert({
      kind: draft.kind,
      name: draft.name.trim(),
      remarks: draft.remarks.trim() || null,
      latitude: draft.latitude,
      longitude: draft.longitude,
    })
    .select('id')
    .single();

  if (error) throw error;
  await replaceCrops(data.id, cleanCrops(draft));
}

export async function updatePlace(id: string, draft: PlaceDraft): Promise<void> {
  const { error } = await supabase
    .from('field_places')
    .update({
      kind: draft.kind,
      name: draft.name.trim(),
      remarks: draft.remarks.trim() || null,
      latitude: draft.latitude,
      longitude: draft.longitude,
    })
    .eq('id', id);

  if (error) throw error;
  await replaceCrops(id, cleanCrops(draft));
}

/** Child crop rows go with it — `on delete cascade` in the schema. */
export async function deletePlace(id: string): Promise<void> {
  const { error } = await supabase.from('field_places').delete().eq('id', id);
  if (error) throw error;
}
