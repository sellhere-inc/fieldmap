import { ArrowLeft, CaretRight, MagnifyingGlass } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { TagFilter } from './TagFilter';
import { matchesTags } from './tags';
import {
  cssVars, KIND_LABEL, PLACE_KINDS, placeColor, VISIT_LABEL,
  type FieldPlace, type PlaceKind, type VisitStatus,
} from './supabase';

export type ListSort = 'tag' | 'status' | 'name';
export type FieldNotesSettings = {
  query: string;
  kind: PlaceKind | 'all';
  status: VisitStatus | 'all';
  sort: ListSort;
};

export function selectPlaces(
  places: FieldPlace[], query: string, kind: PlaceKind | 'all',
  status: VisitStatus | 'all', sort: ListSort, selectedTags: string[] = [],
): FieldPlace[] {
  const search = query.trim().normalize('NFC').toLocaleLowerCase();
  return places.filter((place) =>
    (search !== '' || Boolean(place.remarks?.trim())) &&
    [place.name, place.remarks ?? '', ...place.tags].some((text) =>
      text.normalize('NFC').toLocaleLowerCase().includes(search))
    && (kind === 'all' || place.kind === kind)
    && (status === 'all' || place.visit_status === status)
    && matchesTags(place.tags, selectedTags)
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
  tags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  settings: FieldNotesSettings;
  onSettingsChange: (settings: FieldNotesSettings) => void;
  hidden: boolean;
  loading: boolean;
  error: string | null;
  onSelect: (place: FieldPlace) => void;
  onRetry: () => void;
}

export function PlaceList({ places, tags, selectedTags, onTagsChange, settings, onSettingsChange, hidden, loading, error, onSelect, onRetry }: PlaceListProps) {
  const { query, kind, status, sort } = settings;
  const updateSettings = (change: Partial<FieldNotesSettings>) => onSettingsChange({ ...settings, ...change });
  const results = useMemo(() => selectPlaces(places, query, kind, status, sort, selectedTags),
    [places, query, kind, status, sort, selectedTags]);

  return (
    <section className="sheet contact-list" hidden={hidden} aria-label="Contact list">
      <header className="sheet-head">
        <div>
          <span className="eyebrow">YOUR PEOPLE & PLACES</span><h2>Field notes</h2>
          <p className="muted visit-help">The details that bring your map to life.</p>
        </div>
        <a href="#map" className="icon-btn" aria-label="Back to map" title="Back to map"><ArrowLeft size={20} /></a>
      </header>
      <div className="sheet-body">
        <div className="list-controls">
          <TagFilter tags={tags} selected={selectedTags} onChange={onTagsChange} />
          <label className="list-search-label">
            <span className="sr-only">Search names, remarks, and tags</span><MagnifyingGlass size={20} aria-hidden="true" />
            <input type="search" autoFocus value={query} onChange={(event) => updateSettings({ query: event.target.value })}
              placeholder="Name, remarks, or tag" />
          </label>
          <div className="list-filter-row">
            <label>
              Contact tag
              <select aria-label="Contact tag" value={kind} onChange={(event) => updateSettings({ kind: event.target.value as PlaceKind | 'all' })}>
                <option value="all">All types</option>
                {PLACE_KINDS.map((value) => <option key={value} value={value}>{KIND_LABEL[value]}</option>)}
              </select>
            </label>
            <label>
              Visit tag
              <select aria-label="Visit tag" value={status} onChange={(event) => updateSettings({ status: event.target.value as VisitStatus | 'all' })}>
                <option value="all">All visits</option>
                <option value="planned">Yet to meet</option>
                <option value="met">Met</option>
              </select>
            </label>
          </div>
          <label>
            Sort by
            <select aria-label="Sort by" value={sort} onChange={(event) => updateSettings({ sort: event.target.value as ListSort })}>
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
                    {place.tags.map((tag) => <span className="note-tag" key={tag}>{tag}</span>)}
                  </span>
                </div>
                <span className="note-open">View place <CaretRight size={14} aria-hidden="true" /></span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
