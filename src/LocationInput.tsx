import { LinkSimple, Crosshair, MapPin } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { coordinates, googleMapsUrl, resolveLocationInput, type ResolvedLocation } from './locationInput';

export function LocationInput({ onApply, disabled = false }: { onApply: (point: ResolvedLocation, mapsLink?: string) => void; disabled?: boolean }) {
  const [tab, setTab] = useState<'coordinates' | 'link'>('link');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;
  async function apply() {
    if (pending.current || disabled) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      const point = tab === 'coordinates' ? coordinates(latitude, longitude) : await resolveLocationInput(link);
      let mapsLink: string | undefined;
      if (tab === 'link') {
        try { mapsLink = googleMapsUrl(link).href; } catch { /* Copied coordinates have no source link. */ }
      }
      if (mounted.current) onApplyRef.current(point, mapsLink);
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : 'Could not read this location.');
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <div className="location-input">
    <div className="location-input-tabs" role="group" aria-label="Location input method">
      <button type="button" className="btn" disabled={busy || disabled} aria-pressed={tab === 'coordinates'} onClick={() => { setTab('coordinates'); setError(null); }}><Crosshair size={16} aria-hidden="true" /> Coordinates</button>
      <button type="button" className="btn" disabled={busy || disabled} aria-pressed={tab === 'link'} onClick={() => { setTab('link'); setError(null); }}><LinkSimple size={16} aria-hidden="true" /> Maps link</button>
    </div>
    {tab === 'coordinates' ? <div className="coordinate-fields">
      <label>Latitude<input type="text" inputMode="text" placeholder="9.931200" value={latitude} disabled={busy || disabled} onChange={(event) => setLatitude(event.target.value)} /></label>
      <label>Longitude<input type="text" inputMode="text" placeholder="76.267300" value={longitude} disabled={busy || disabled} onChange={(event) => setLongitude(event.target.value)} /></label>
    </div> : <label>Google Maps link<input type="text" autoCapitalize="none" autoCorrect="off" placeholder="Paste a link or 9.9312, 76.2673" value={link} disabled={busy || disabled} onChange={(event) => setLink(event.target.value)} /></label>}
    {error && <p className="error" role="alert">{error}</p>}
    <button type="button" className="btn location-apply" disabled={busy || disabled || (tab === 'link' ? !link.trim() : !latitude.trim() || !longitude.trim())} onClick={() => void apply()}><MapPin size={17} aria-hidden="true" /> {busy ? 'Reading location…' : 'Preview pin'}</button>
  </div>;
}
