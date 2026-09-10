import { SlidersHorizontal, CaretDown } from '@phosphor-icons/react';
import { useState } from 'react';
import { tagKey } from './tags';

interface TagFilterProps {
  tags: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function TagFilter({ tags, selected, onChange }: TagFilterProps) {
  const [query, setQuery] = useState('');
  const results = tags.filter((tag) => tagKey(tag).includes(tagKey(query)));
  return <details className="tag-filter">
    <summary><SlidersHorizontal size={17} aria-hidden="true" /> Tags <span>{selected.length ? selected.length + ' selected' : 'All'}</span><CaretDown size={13} className="tag-caret" aria-hidden="true" /></summary>
    <div className="tag-filter-panel">
      <p className="muted">Show pins with any selected tag.</p>
      <label className="note-label">Find a tag
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search available tags" />
      </label>
      <button type="button" className="btn btn--ghost" disabled={!selected.length} onClick={() => onChange([])}>Clear tag filter</button>
      <div className="tag-filter-options">
        {results.map((tag) => {
          const checked = selected.some((value) => tagKey(value) === tagKey(tag));
          return <label key={tag}>
            <input type="checkbox" checked={checked} onChange={() => onChange(checked
              ? selected.filter((value) => tagKey(value) !== tagKey(tag)) : [...selected, tag])} />
            <span>{tag}</span>
          </label>;
        })}
        {!results.length && <p className="muted">{tags.length ? 'No matching tags.' : 'No tags yet. Add a tag when saving a pin.'}</p>}
      </div>
    </div>
  </details>;
}
