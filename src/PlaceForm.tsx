import {
  cssVars,
  placeColor,
  VISIT_LABEL,
  type VisitStatus,
  KIND_LABEL,
  PLACE_KINDS,
  type PlaceDraft,
  type PlaceKind,
} from './supabase';

interface PlaceFormProps {
  draft: PlaceDraft;
  isEditing: boolean;
  busy: boolean;
  error: string | null;
  /** Crop names already used anywhere, for the autocomplete list. */
  cropSuggestions: string[];
  onChange: (draft: PlaceDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  onReposition: () => void;
}

export function PlaceForm({
  draft,
  isEditing,
  busy,
  error,
  cropSuggestions,
  onChange,
  onSave,
  onCancel,
  onReposition,
}: PlaceFormProps) {
  const set = <K extends keyof PlaceDraft>(key: K, value: PlaceDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const setCrop = (index: number, key: 'crop_name' | 'avg_yield', value: string) => {
    const crops = draft.crops.map((crop, i) => (i === index ? { ...crop, [key]: value } : crop));
    onChange({ ...draft, crops });
  };

  const addCrop = () => onChange({ ...draft, crops: [...draft.crops, { crop_name: '', avg_yield: '' }] });

  const removeCrop = (index: number) =>
    onChange({ ...draft, crops: draft.crops.filter((_, i) => i !== index) });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave();
  };

  return (
    <form
      className={`sheet ${draft.visit_status === 'planned' ? 'sheet--planned' : ''}`}
      style={cssVars({ '--place-color': placeColor(draft) })}
      onSubmit={submit}
    >
      <header className="sheet-head">
        <h2>{isEditing ? 'Edit location' : 'New location'}</h2>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Cancel">
          ✕
        </button>
      </header>

      <div className="sheet-body">
        <div className="field">
          <h3>Visit status</h3>
          <div className="chip-row" role="group" aria-label="Visit status">
            {(['met', 'planned'] as VisitStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                className={`chip ${status === 'planned' ? 'chip--planned' : ''} ${draft.visit_status === status ? 'is-on' : ''}`}
                style={cssVars({ '--chip-color': placeColor({ ...draft, visit_status: status }) })}
                aria-pressed={draft.visit_status === status}
                disabled={busy}
                onClick={() => set('visit_status', status)}
              >
                {VISIT_LABEL[status]}
              </button>
            ))}
          </div>
          <p className="muted visit-help">Plan a visit now; change to Met after you meet them.</p>
        </div>
        <div className="field">
          <h3>Type</h3>
          <div className="chip-row">
            {PLACE_KINDS.map((kind: PlaceKind) => (
              <button
                key={kind}
                type="button"
                className={`chip ${draft.visit_status === 'planned' ? 'chip--planned' : ''} ${draft.kind === kind ? 'is-on' : ''}`}
                aria-pressed={draft.kind === kind}
                style={cssVars({ '--chip-color': placeColor({ ...draft, kind }) })}
                onClick={() => set('kind', kind)}
              >
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <h3>Name</h3>
          <input
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder={draft.kind === 'farmer' ? 'Farmer’s name' : 'Business name'}
            required
            autoFocus
          />
        </label>

        {/* Crops are a farmer-only concern — buyers and warehouses record a
            name and remarks only. */}
        {draft.kind === 'farmer' && (
          <div className="field">
            <h3>Crops cultivated</h3>
            <datalist id="crop-suggestions">
              {cropSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            {draft.crops.map((crop, index) => (
              <div className="crop-row" key={index}>
                <input
                  list="crop-suggestions"
                  value={crop.crop_name}
                  onChange={(e) => setCrop(index, 'crop_name', e.target.value)}
                  placeholder="Crop"
                  aria-label={`Crop ${index + 1}`}
                />
                <input
                  value={crop.avg_yield}
                  onChange={(e) => setCrop(index, 'avg_yield', e.target.value)}
                  placeholder="Avg yield (optional)"
                  aria-label={`Average yield for crop ${index + 1}`}
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => removeCrop(index)}
                  aria-label={`Remove crop ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}

            <button type="button" className="btn btn--ghost" onClick={addCrop}>
              + Add crop
            </button>
          </div>
        )}

        <label className="field">
          <h3>Remarks</h3>
          <textarea
            value={draft.remarks}
            onChange={(e) => set('remarks', e.target.value)}
            rows={5}
            placeholder={draft.visit_status === 'planned'
              ? 'Visit plans, contact details, questions to ask…'
              : 'Anything worth remembering about this place.'}
          />
        </label>

        <div className="field">
          <h3>Location</h3>
          <p className="muted">
            {draft.latitude.toFixed(6)}, {draft.longitude.toFixed(6)}
          </p>
          <button type="button" className="btn btn--ghost" onClick={onReposition}>
            Reposition on map
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </div>

      <footer className="sheet-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </footer>
    </form>
  );
}
