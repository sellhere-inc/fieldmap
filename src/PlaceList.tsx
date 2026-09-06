import { useMemo, useState } from 'react';
import {
  cssVars, KIND_LABEL, PLACE_KINDS, placeColor, VISIT_LABEL,
  type FieldPlace, type PlaceKind, type VisitStatus,
} from './supabase';

export type ListSort = 'tag' | 'status' | 'name';

export function selectPlaces(
  places: FieldPlace[], query: string, kind: PlaceKind | 'all',
  status: VisitStatus | 'all', sort: ListSort,
): FieldPlace[] {
  const search = query.trim().normalize('NFC').toLocaleLowerCase();
  return places.filter((place) =>
    [place.name, place.remarks ?? ''].some((text) =>
      text.normalize('NFC').toLocaleLowerCase().includes(search))
    && (kind === 'all' || place.kind === kind)
    && (status === 'all' || place.visit_status === status)
  ).sort((a, b) => {
    const byKind = KIND_LABEL[a.kind].localeCompare(KIND_LABEL[b.kind]);
    const byStatus = Number(a.visit_status === 'met') - Number(b.visit_status === 'met');
    const byName = a.name.localeCompare(b.name);
    if (sort === 'tag') return byKind || byStatus || byName || a.id.localeCompare(b.id);
    if (sort === 'status') return byStatus || byKind || byName || a.id.localeCompare(b.id);
    return byName || a.id.localeCompare(b.id);
  });
}

interface PlaceListProps {
  places: FieldPlace[];
  hidden: boolean;
  loading: boolean;
  error: string | null;
  onSelect: (place: FieldPlace) => void;
  onRetry: () => void;
}

export function PlaceList({ places, hidden, loading, error, onSelect, onRetry }: PlaceListProps) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<PlaceKind | 'all'>('all');
  const [status, setStatus] = useState<VisitStatus | 'all'>('all');
  const [sort, setSort] = useState<ListSort>('tag');
  const results = useMemo(() => selectPlaces(places, query, kind, status, sort),
    [places, query, kind, status, sort]);

  return (
    <section className="sheet contact-list" hidden={hidden} aria-label="Contact list">
      <header className="sheet-head">
        <div>
          <h2>Field notes</h2>
          <p className="muted visit-help">Remarks first, people close by.</p>
        </div>
        <a href="#map" className="btn btn--ghost">Back to map</a>
      </header>
      <div className="sheet-body">
        <div className="list-controls">
          <label>
            Search names and remarks
            <input type="search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or remarks text" />
          </label>
          <div className="list-filter-row">
            <label>
              Contact tag
              <select aria-label="Contact tag" value={kind} onChange={(event) => setKind(event.target.value as PlaceKind | 'all')}>
                <option value="all">All types</option>
                {PLACE_KINDS.map((value) => <option key={value} value={value}>{KIND_LABEL[value]}</option>)}
              </select>
            </label>
            <label>
              Visit tag
              <select aria-label="Visit tag" value={status} onChange={(event) => setStatus(event.target.value as VisitStatus | 'all')}>
                <option value="all">All visits</option>
                <option value="planned">Yet to meet</option>
                <option value="met">Met</option>
              </select>
            </label>
          </div>
          <label>
            Sort by
            <select aria-label="Sort by" value={sort} onChange={(event) => setSort(event.target.value as ListSort)}>
              <option value="tag">Contact tag</option>
              <option value="status">Visit tag — planned first</option>
              <option value="name">Name — A to Z</option>
            </select>
          </label>
        </div>

        {error && <div role="alert" className="error">{error} <button type="button" className="btn" onClick={onRetry}>Retry</button></div>}
        <p className="muted list-count" role="status">
          {loading ? 'Loading contacts…' : `${results.length} ${results.length === 1 ? 'contact' : 'contacts'}`}
        </p>
        {!loading && !error && results.length === 0 && (
          <p className="muted">{places.length ? 'No matching contacts. Try another name, remark, or tag.' : 'No contacts yet. Add a location on the map to start.'}</p>
        )}
        <ul className="notes-list">
          {results.map((place) => (
            <li key={place.id}>
              <button type="button"
                className={`note-card ${place.visit_status === 'planned' ? 'note-card--planned' : ''}`}
                style={cssVars({ '--place-color': placeColor(place) })}
                onClick={() => onSelect(place)}
              >
                <p className={`note-remarks ${place.remarks?.trim() ? '' : 'muted'}`}>
                  {place.remarks?.trim() || 'No remarks yet.'}
                </p>
                <div className="note-person">
                  <span className="note-name">{place.name}</span>
                  <span className="note-tags">
                    <span className="note-tag">{KIND_LABEL[place.kind]}</span>
                    <span className="note-tag">{VISIT_LABEL[place.visit_status]}</span>
                  </span>
                </div>
                <span className="note-open">Open details →</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
