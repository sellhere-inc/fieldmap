import { cssVars, KIND_COLOR, KIND_LABEL, type FieldPlace } from './supabase';

interface PlaceSheetProps {
  place: FieldPlace;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  busy: boolean;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function PlaceSheet({ place, onEdit, onDelete, onClose, busy }: PlaceSheetProps) {
  const crops = [...place.field_place_crops].sort((a, b) => a.sort_order - b.sort_order);
  const coords = `${place.latitude.toFixed(6)}, ${place.longitude.toFixed(6)}`;

  return (
    <section className="sheet" aria-label={place.name}>
      <header className="sheet-head">
        <div>
          <span className="badge" style={cssVars({ '--badge-color': KIND_COLOR[place.kind] })}>
            {KIND_LABEL[place.kind]}
          </span>
          <h2>{place.name}</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div className="sheet-body">
        {place.kind === 'farmer' && (
          <div className="field">
            <h3>Crops</h3>
            {crops.length === 0 ? (
              <p className="muted">No crops recorded.</p>
            ) : (
              <ul className="crop-list">
                {crops.map((crop) => (
                  <li key={crop.id}>
                    <span className="crop-name">{crop.crop_name}</span>
                    {crop.avg_yield && <span className="crop-yield">{crop.avg_yield}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="field">
          <h3>Remarks</h3>
          {place.remarks ? (
            <p className="remarks">{place.remarks}</p>
          ) : (
            <p className="muted">No remarks.</p>
          )}
        </div>

        <div className="field">
          <h3>Location</h3>
          <p className="muted">{coords}</p>
          <a
            className="link"
            href={`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps
          </a>
        </div>

        <p className="muted small">
          Added {formatWhen(place.created_at)}
          {place.updated_at !== place.created_at && ` · updated ${formatWhen(place.updated_at)}`}
        </p>
      </div>

      <footer className="sheet-actions">
        <button type="button" className="btn" onClick={onEdit} disabled={busy}>
          Edit
        </button>
        <button type="button" className="btn btn--danger" onClick={onDelete} disabled={busy}>
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </footer>
    </section>
  );
}
