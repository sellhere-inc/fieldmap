import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LoginScreen } from './LoginScreen';
import { MapCanvas, type FocusRequest, type MapStyleName } from './MapCanvas';
import { PlaceForm } from './PlaceForm';
import { PlaceSheet } from './PlaceSheet';
import { PlaceList } from './PlaceList';
import { GeneralNotes } from './GeneralNotes';
import { LocationInput } from './LocationInput';
import { TagFilter } from './TagFilter';
import { cleanTags, matchesTags } from './tags';
import { fieldErrorMessage } from './errors';
import { requestLocation, locationErrorMessage, type UserLocation } from './location';
import {
  createPlace,
  cssVars,
  deletePlace,
  fetchPlaces,
  fetchTagNames,
  KIND_COLOR,
  KIND_PLURAL,
  PLACE_KINDS,
  supabase,
  updatePlace,
  type FieldPlace,
  type PlaceDraft,
  type PlaceKind,
} from './supabase';

/** idle → tap markers. placing → drop or drag the pin. form → fill in details. */
type Mode = 'idle' | 'placing' | 'form';

function blankDraft(lat: number, lng: number): PlaceDraft {
  return { kind: 'trader', visit_status: 'planned', name: '', tags: [], remarks: '', latitude: lat, longitude: lng, google_maps_url: '', crops: [] };
}

function draftFromPlace(place: FieldPlace): PlaceDraft {
  return {
    kind: place.kind,
    visit_status: place.visit_status,
    name: place.name,
    tags: [...place.tags],
    remarks: place.remarks ?? '',
    latitude: place.latitude,
    longitude: place.longitude,
    google_maps_url: place.google_maps_url ?? '',
    crops: [...place.field_place_crops]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((crop) => ({ crop_name: crop.crop_name, avg_yield: crop.avg_yield ?? '' })),
  };
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isMember, setIsMember] = useState<boolean | null>(null);

  const [places, setPlaces] = useState<FieldPlace[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [listOpen, setListOpen] = useState(window.location.hash === '#contacts');
  const [notesOpen, setNotesOpen] = useState(window.location.hash === '#notes');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [visibleKinds, setVisibleKinds] = useState<Set<PlaceKind>>(new Set(PLACE_KINDS));
  const [styleName, setStyleName] = useState<MapStyleName>('dark');
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const locationPending = useRef(false);

  const [mode, setMode] = useState<Mode>('idle');
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // The id, not the row. Holding the object would leave the open sheet showing
  // pre-edit values after a save refreshes the list.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlaceDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Hash navigation gives the phone list its own page and browser Back support.
  useEffect(() => {
    const navigate = () => {
      setListOpen(window.location.hash === '#contacts');
      setNotesOpen(window.location.hash === '#notes');
      setSelectedId(null);
      setMode('idle');
      setDraft(null);
      setEditingId(null);
      setFormError(null);
      setNotice(null);
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  // --- session -------------------------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Membership is a row in `field_members`, not a role. Checking it up front
  // means an unauthorised account gets a plain explanation instead of a map
  // that silently returns nothing.
  useEffect(() => {
    if (!session) {
      setIsMember(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('field_members')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsMember(data !== null);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const reload = useCallback(async () => {
    setPlacesLoading(true);
    try {
      setPlaces(await fetchPlaces());
      setTagSuggestions(await fetchTagNames());
      setLoadError(null);
    } catch (error) {
      setLoadError(fieldErrorMessage(error, 'Could not load locations.'));
    } finally {
      setPlacesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isMember) void reload();
  }, [isMember, reload]);

  // --- derived -------------------------------------------------------------
  const tagOptions = useMemo(() => cleanTags([...tagSuggestions, ...places.flatMap((place) => place.tags)])
    .sort((a, b) => a.localeCompare(b)), [tagSuggestions, places]);
  const taggedPlaces = useMemo(() => places.filter((place) => matchesTags(place.tags, selectedTags)), [places, selectedTags]);
  // Resolved fresh from `places`, so an edit or a reload is reflected straight
  // away — and a row deleted elsewhere closes the sheet instead of stranding it.
  const selected = useMemo(
    () => taggedPlaces.find((place) => place.id === selectedId) ?? null,
    [taggedPlaces, selectedId]
  );

  // Autocomplete comes free from the list already in memory.
  const cropSuggestions = useMemo(() => {
    const names = new Set<string>();
    for (const place of places) {
      for (const crop of place.field_place_crops) names.add(crop.crop_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [places]);

  const counts = useMemo(() => {
    const tally = { farmer: 0, trader: 0, warehouse: 0 } as Record<PlaceKind, number>;
    for (const place of taggedPlaces) tally[place.kind] += 1;
    return tally;
  }, [taggedPlaces]);

  // --- actions -------------------------------------------------------------
  const toggleKind = (kind: PlaceKind) => {
    setVisibleKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const positionDraft = useCallback((lat: number, lng: number) => {
    setDraft((current) => (current ? { ...current, latitude: lat, longitude: lng } : blankDraft(lat, lng)));
  }, []);

  const handleLongPress = useCallback(
    (lat: number, lng: number) => {
      if (listOpen && mode !== 'placing') return;
      // A long press anywhere starts a new pin, even from idle — that is the
      // fastest path when you are standing in a field with one hand free.
      setSelectedId(null);
      setNotice(null);
      positionDraft(lat, lng);
      setMode((current) => (current === 'form' ? 'form' : 'placing'));
    },
    [positionDraft, listOpen, mode]
  );

  const showMap = () => {
    window.history.replaceState(null, '', '#map');
    setListOpen(false);
    setNotesOpen(false);
  };

  const selectPlace = (place: FieldPlace) => {
    showMap();
    setMode('idle');
    setSelectedId(place.id);
    setVisibleKinds((current) => new Set([...current, place.kind]));
    setFocus((current) => ({ lat: place.latitude, lng: place.longitude, zoom: 16,
      nonce: (current?.nonce ?? 0) + 1 }));
  };

  const startPlacing = () => {
    showMap();
    setSelectedId(null);
    setEditingId(null);
    setDraft(null);
    setFormError(null);
    setNotice(null);
    setMode('placing');
  };

  const locateMe = async () => {
    if (locationPending.current) return;
    if (!window.isSecureContext) {
      setNotice('Open this site over HTTPS to use your location.');
      return;
    }
    if (!navigator.geolocation) {
      setNotice('This browser has no location support.');
      return;
    }
    if (mode === 'idle') showMap();
    locationPending.current = true;
    setLocating(true);
    const requestedMode = mode;
    setNotice('Finding you…');
    try {
      const location = await requestLocation(navigator.geolocation);
      setUserLocation(location);
      setNotice(`Location found · accuracy about ${Math.max(1, Math.round(location.accuracy))} m.`);
      if (modeRef.current === requestedMode) {
        setSelectedId(null);
        setFocus((current) => ({ ...location,
          zoom: location.accuracy > 1000 ? 12 : location.accuracy > 100 ? 14 : 16,
          nonce: (current?.nonce ?? 0) + 1,
        }));
        if (requestedMode === 'placing') positionDraft(location.lat, location.lng);
      }
    } catch (error) {
      setNotice(locationErrorMessage(error));
    } finally {
      locationPending.current = false;
      setLocating(false);
    }
  };

  const openForm = () => {
    setFormError(null);
    setNotice(null);
    setMode('form');
  };

  const editSelected = () => {
    if (!selected) return;
    setNotice(null);
    setDraft(draftFromPlace(selected));
    setEditingId(selected.id);
    setSelectedId(null);
    setFormError(null);
    setMode('form');
  };

  const cancelEditing = () => {
    setMode('idle');
    setDraft(null);
    setEditingId(null);
    setFormError(null);
  };

  const save = async (submittedDraft: PlaceDraft) => {
    if (busy) return;
    if (!submittedDraft.name.trim()) {
      setFormError('A name is required.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (editingId) await updatePlace(editingId, submittedDraft);
      else await createPlace(submittedDraft);
      await reload();
      cancelEditing();
    } catch (error) {
      setFormError(fieldErrorMessage(error, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  };

  const removeSelected = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete “${selected.name}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deletePlace(selected.id);
      await reload();
      setSelectedId(null);
    } catch (error) {
      setNotice(fieldErrorMessage(error, 'Could not delete.'));
    } finally {
      setBusy(false);
    }
  };

  // --- gates ---------------------------------------------------------------
  if (!authReady) return <main className="login-band" />;
  if (!session) return <LoginScreen />;

  if (isMember === false) {
    return (
      <main className="login-band">
        <div className="setup-card">
          <h2>Not authorised</h2>
          <p>
            This account is not on the field map team. Ask an admin to add you to{' '}
            <code>public.field_members</code>.
          </p>
          <button type="button" className="btn" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </main>
    );
  }

  // On a wide screen the sheet becomes a fixed right-hand panel, so the
  // floating controls have to step aside for it.
  const panelOpen = (listOpen && mode !== 'placing') || mode === 'form' || (mode === 'idle' && selected !== null);

  return (
    <div className={`app ${selected ? 'has-selection' : ''} ${notesOpen ? 'has-general-notes' : ''} ${panelOpen ? 'has-panel' : ''} ${listOpen && mode !== 'placing' ? 'has-list' : ''} ${mode === 'idle' && !listOpen ? 'has-search' : ''}`}>
      <nav className="workspace-tabs" aria-label="Workspace">
        <a href="#map" aria-current={!listOpen && !notesOpen ? 'page' : undefined}>Map</a>
        <a href="#contacts" aria-current={listOpen ? 'page' : undefined}>Field notes</a>
        <a href="#notes" aria-current={notesOpen ? 'page' : undefined}>General notes</a>
      </nav>
      {isMember && <GeneralNotes key={session.user.id} hidden={!notesOpen} />}
      <div className="map-workspace">
      <MapCanvas
        places={taggedPlaces}
        visibleKinds={visibleKinds}
        selectedId={selected?.id ?? null}
        draftPoint={
          mode !== 'idle' && draft ? { lat: draft.latitude, lng: draft.longitude } : null
        }
        styleName={styleName}
        focus={focus}
        userLocation={userLocation}
        onSelect={(place) => {
          if (mode === 'form' || listOpen) return;
          selectPlace(place);
        }}
        onLongPress={handleLongPress}
        onDraftMove={positionDraft}
      />

      <div className="top-bar">
        <div className="top-right">
          <button
            type="button"
            className="btn btn--tiny"
            onClick={() => setStyleName(styleName === 'dark' ? 'satellite' : 'dark')}
          >
            {styleName === 'dark' ? 'Satellite' : 'Dark'}
          </button>
          <button type="button" className="btn btn--tiny" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
        {mode === 'idle' && !listOpen && (
          <a href="#contacts" className="map-search" aria-label="Search names and remarks">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5" />
            </svg>
            <span>Search names and remarks</span>
          </a>
        )}
      </div>

      {/* Its own scrolling strip rather than sharing the top bar: at these
          proportions three labelled pills plus two buttons will not fit across
          a phone without wrapping into a muddle. */}
      <div className="filter-strip">
        <div className="chip-row">
          {PLACE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`chip ${visibleKinds.has(kind) ? 'is-on' : ''}`}
              style={cssVars({ '--chip-color': KIND_COLOR[kind] })}
              aria-pressed={visibleKinds.has(kind)}
              onClick={() => toggleKind(kind)}
            >
              {KIND_PLURAL[kind]}
              <span className="chip-count">{counts[kind]}</span>
            </button>
          ))}
        </div>
        <div className="map-tag-filter">
          <TagFilter tags={tagOptions} selected={selectedTags} onChange={(tags) => { setSelectedTags(tags); setSelectedId(null); }} />
          {selectedTags.length > 0 && <p className="tag-filter-count" role="status">
            {taggedPlaces.filter((place) => visibleKinds.has(place.kind)).length} matching pins
          </p>}
        </div>
      </div>

      {(loadError || notice) && <div className="toast" role="status">{notice ?? loadError}</div>}

      {mode === 'placing' && (
        <div className="banner">
          <h2>Choose a location</h2>
          <LocationInput onApply={({ lat, lng, name }, mapsLink) => {
            setDraft((current) => ({ ...(current ?? blankDraft(lat, lng)), latitude: lat, longitude: lng,
              google_maps_url: mapsLink ?? current?.google_maps_url ?? '',
              name: current?.name.trim() ? current.name : name ?? '' }));
            setFocus((current) => ({ lat, lng, zoom: 16, nonce: (current?.nonce ?? 0) + 1 }));
            setNotice('Location set. Review the pin, then continue.');
          }} />
          <p>
            {draft
              ? 'Drag the pin to fine-tune, then continue.'
              : 'Or long-press the map to drop a pin, or use your current location.'}
          </p>
          <div className="banner-actions">
            <button type="button" className="btn btn--ghost" onClick={cancelEditing}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={locateMe} disabled={locating}>
              {locating ? 'Finding you…' : 'Use my location'}
            </button>
            <button type="button" className="btn btn--primary" onClick={openForm} disabled={!draft}>
              Continue
            </button>
          </div>
        </div>
      )}

      </div>

        <div className="fabs" role="group" aria-label="Map actions">
          <button type="button" className="fab" onClick={locateMe} disabled={locating}
            aria-label={locating ? 'Finding your location' : 'Use my location'} aria-busy={locating}>
            {locating ? 'Finding you…' : '◎ Current location'}
          </button>
          <button
            type="button"
            className="fab fab--primary"
            onClick={startPlacing}
            disabled={mode !== 'idle' || busy}
            title={mode !== 'idle' ? 'Finish or cancel the current location first' : 'Add a location'}
            aria-label="Add a location"
          >
            + Add location
          </button>
        </div>

      {listOpen && (
        <PlaceList places={places} hidden={mode !== 'idle' || selected !== null}
          tags={tagOptions} selectedTags={selectedTags} onTagsChange={(tags) => { setSelectedTags(tags); setSelectedId(null); }}
          loading={placesLoading} error={loadError}
          onRetry={() => void reload()} onSelect={selectPlace} />
      )}

      {listOpen && notice && <div className="list-notice" role="status">{notice}</div>}

      {mode === 'idle' && selected && (
        <PlaceSheet
          place={selected}
          onEdit={editSelected}
          onDelete={removeSelected}
          onClose={() => setSelectedId(null)}
          closeLabel={listOpen ? 'Back to list' : undefined}
          busy={busy}
        />
      )}

      {mode === 'form' && draft && (
        <PlaceForm
          draft={draft}
          isEditing={editingId !== null}
          busy={busy}
          error={formError}
          cropSuggestions={cropSuggestions}
          tagSuggestions={tagSuggestions}
          onChange={setDraft}
          onSave={save}
          onCancel={cancelEditing}
          onReposition={() => setMode('placing')}
        />
      )}
    </div>
  );
}
