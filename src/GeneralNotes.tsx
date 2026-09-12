import { Plus, NotePencil, PushPin, ArrowLeft, DownloadSimple, Trash, Check } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from './supabase';
import { fieldErrorMessage } from './errors';
import { hasLocal, readLocal, writeLocal } from './localCache';

type Note = { id: string; title: string; content: string; pinned: boolean; updated_at: string };
type Draft = Pick<Note, 'id' | 'title' | 'content' | 'pinned'>;
type NotesCache = { notes: Note[]; query: string; draft: Draft | null; original: string; lastOpenedId: string | null };
const emptyCache: NotesCache = { notes: [], query: '', draft: null, original: '', lastOpenedId: null };

function cachedNotes(userId: string): NotesCache {
  return readLocal<NotesCache>('general-notes', emptyCache, userId);
}

function restoredDraft(cache: NotesCache): Draft | null {
  return cache.draft ?? (cache.lastOpenedId
    ? cache.notes.find((note) => note.id === cache.lastOpenedId)
    : null) ?? null;
}

export function GeneralNotes({ hidden, userId }: { hidden: boolean; userId: string }) {
  const [notes, setNotes] = useState<Note[]>(() => cachedNotes(userId).notes);
  const [loading, setLoading] = useState(() => !hasLocal('general-notes', userId));
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(() => cachedNotes(userId).query);
  const [draft, setDraft] = useState<Draft | null>(() => restoredDraft(cachedNotes(userId)));
  const [original, setOriginal] = useState(() => {
    const cache = cachedNotes(userId);
    const restored = restoredDraft(cache);
    return cache.draft ? cache.original : restored ? JSON.stringify(restored) : '';
  });
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(() => cachedNotes(userId).lastOpenedId);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const dirty = draft !== null && JSON.stringify(draft) !== original;
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('field_general_notes').select('id,title,content,pinned,updated_at');
      if (error) throw error;
      setNotes(data ?? []); setError(null);
    } catch (error) { setError(fieldErrorMessage(error, 'Could not load notes.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    writeLocal('general-notes', { notes, query, draft, original, lastOpenedId }, userId);
  }, [notes, query, draft, original, lastOpenedId, userId]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function open(note?: Note) {
    const next = note ? { id: note.id, title: note.title, content: note.content, pinned: note.pinned }
      : { id: crypto.randomUUID(), title: '', content: '', pinned: false };
    setDraft(next); setOriginal(JSON.stringify(next)); setLastOpenedId(next.id); setEditing(false); setError(null);
  }
  function close() {
    if (pending.current || (dirty && !window.confirm('Discard unsaved changes to this note?'))) return;
    setDraft(null); setEditing(false); setError(null);
  }
  async function save() {
    if (!draft || pending.current) return;
    if (!draft.title.trim() && !draft.content.trim()) { setError('Add a title or some note text.'); return; }
    pending.current = true; setBusy(true); setError(null);
    try {
      const { data, error } = await supabase.from('field_general_notes')
        .upsert({ ...draft, title: draft.title.trim() }).select('id,title,content,pinned,updated_at').single();
      if (error) throw error;
      setNotes((current) => [data, ...current.filter((note) => note.id !== data.id)]);
      setDraft({ id: data.id, title: data.title, content: data.content, pinned: data.pinned });
      setOriginal(JSON.stringify({ id: data.id, title: data.title, content: data.content, pinned: data.pinned }));
      setLastOpenedId(data.id);
      setEditing(false);
    } catch (error) { setError(fieldErrorMessage(error, 'Could not save note. Your changes are still here.')); }
    finally { pending.current = false; setBusy(false); }
  }
  async function remove() {
    if (!draft || pending.current || !window.confirm('Delete this note? This cannot be undone.')) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      const { data, error } = await supabase.from('field_general_notes').delete().eq('id', draft.id).select('id').single();
      if (error) throw error;
      setNotes((current) => current.filter((note) => note.id !== data.id));
      setDraft(null); setEditing(false);
      if (lastOpenedId === data.id) setLastOpenedId(null);
    } catch (error) { setError(fieldErrorMessage(error, 'Could not delete note.')); }
    finally { pending.current = false; setBusy(false); }
  }
  function download() {
    if (!draft) return;
    const text = (draft.title ? '# ' + draft.title + '\n\n' : '') + draft.content + '\n';
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = (draft.title || 'Untitled note').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 100) + '.md';
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const search = query.trim().normalize('NFC').toLocaleLowerCase();
  const results = notes.filter((note) => (note.title + '\n' + note.content).normalize('NFC').toLocaleLowerCase().includes(search))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));

  return <main className="general-notes" hidden={hidden}>
    <div className="general-notes-inner">
      <header className="general-notes-head">
        <div><span className="eyebrow">A LITTLE ROOM TO THINK</span><h1>Notes</h1><p className="muted">Ideas, plans, and anything else. Shared with your field team.</p></div>
        {!draft && <button className="btn btn--primary" onClick={() => open()}><Plus size={18} aria-hidden="true" /> New note</button>}
      </header>
      {error && <p className="error" role="alert">{error} {!draft && <button className="btn" onClick={() => void reload()}>Retry</button>}</p>}
      {draft ? <section className="note-editor" aria-label="Note editor">
        <div className="note-editor-toolbar">
          <button className="btn btn--ghost" disabled={busy} onClick={close}><ArrowLeft size={17} aria-hidden="true" /> Back to notes</button>
          <span className="muted" role="status">{busy ? 'Saving changes…' : dirty ? 'Unsaved changes' : editing ? 'Editing Markdown' : 'Preview'}</span>
        </div>
        {editing && <label className="note-label">Title<input autoFocus placeholder="Untitled note" value={draft.title} disabled={busy}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>}
        <div className="note-editor-toolbar">
          <div className="note-view-toggle" role="group" aria-label="Note view">
            <button className="btn" aria-pressed={!editing} disabled={busy || !editing} onClick={() => setEditing(false)}>Preview</button>
            <button className="btn" aria-pressed={editing} disabled={busy} onClick={() => setEditing(true)}>Edit Markdown</button>
          </div>
          {editing && <button className="btn" aria-pressed={draft.pinned} disabled={busy} onClick={() => setDraft({ ...draft, pinned: !draft.pinned })}>{draft.pinned ? 'Pinned' : 'Pin note'}</button>}
        </div>
        {editing ? <label className="note-label">Markdown<textarea className="markdown-input" rows={14} value={draft.content} disabled={busy}
            placeholder={'# Heading\n\nWrite a note…\n\n- [ ] A task\n- A list item\n\n**Bold** and *italic*'}
            onChange={(event) => setDraft({ ...draft, content: event.target.value })} /></label>
          : <div className="markdown-body note-preview">{draft.title && <h1>{draft.title}</h1>}<Markdown remarkPlugins={[remarkGfm]}>{draft.content || '*Nothing to preview yet.*'}</Markdown></div>}
        {editing && <p className="muted">Use # headings, **bold**, - lists, and - [ ] checklists.</p>}
        <footer className="note-editor-toolbar">
          <div className="note-editor-toolbar">
            {notes.some((note) => note.id === draft.id) && <button className="btn btn--danger" disabled={busy} onClick={() => void remove()}><Trash size={17} aria-hidden="true" /> Delete</button>}
            <button className="btn" onClick={download}><DownloadSimple size={17} aria-hidden="true" /> Download</button>
          </div>
          {editing && <button className="btn btn--primary" disabled={busy || !dirty} onClick={() => void save()}><Check size={17} aria-hidden="true" /> {busy ? 'Saving…' : 'Save note'}</button>}
        </footer>
      </section> : <>
        <label className="note-label">Search notes<input type="search" placeholder="Search titles and note text" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <p className="muted list-count" role="status">{loading ? 'Loading notes…' : results.length + (results.length === 1 ? ' note' : ' notes')}</p>
        {!loading && !error && !results.length && <div className="notes-empty"><NotePencil size={42} weight="duotone" aria-hidden="true" /><h2>{notes.length ? 'No matching notes' : 'A place for every idea'}</h2><p className="muted">{notes.length ? 'Try a different search.' : 'Create your first note. Write freely in Markdown and keep each topic on its own card.'}</p></div>}
        <div className="general-notes-grid">{results.map((note) => <button key={note.id} className="general-note-card" onClick={() => open(note)}>
          {note.pinned && <span className="general-note-pin"><PushPin size={14} weight="fill" aria-hidden="true" /> Pinned</span>}
          <h2>{note.title || 'Untitled note'}</h2>
          <div className="markdown-body general-note-excerpt"><Markdown remarkPlugins={[remarkGfm]}>{note.content || '*Empty note*'}</Markdown></div>
          <time dateTime={note.updated_at}>{new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
        </button>)}</div>
      </>}
    </div>
  </main>;
}
