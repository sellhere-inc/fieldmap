import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { KIND_COLOR, MAPBOX_TOKEN, type FieldPlace, type PlaceKind } from './supabase';
import { useLongPress } from './useLongPress';

export const MAP_STYLES = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const;

export type MapStyleName = keyof typeof MAP_STYLES;

/** Ernakulam, matching DEFAULT_DISTRICT in the mobile app's location model. */
const DEFAULT_CENTER: [number, number] = [76.2673, 9.9312];
const DEFAULT_ZOOM = 8;

export interface FocusRequest {
  lng: number;
  lat: number;
  zoom?: number;
  /** Bumped by the caller to re-trigger a jump to the same coordinates. */
  nonce: number;
}

interface MapCanvasProps {
  places: FieldPlace[];
  visibleKinds: Set<PlaceKind>;
  selectedId: string | null;
  draftPoint: { lat: number; lng: number } | null;
  styleName: MapStyleName;
  focus: FocusRequest | null;
  onSelect: (place: FieldPlace) => void;
  onLongPress: (lat: number, lng: number) => void;
  onDraftMove: (lat: number, lng: number) => void;
}

export function MapCanvas({
  places,
  visibleKinds,
  selectedId,
  draftPoint,
  styleName,
  focus,
  onSelect,
  onLongPress,
  onDraftMove,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);

  // Markers are imperative and long-lived; callbacks change on every render.
  // Reading them through refs keeps the click handler stable so markers are
  // not torn down and rebuilt each time the parent re-renders.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onDraftMoveRef = useRef(onDraftMove);
  onDraftMoveRef.current = onDraftMove;

  const markersRef = useRef(new Map<string, mapboxgl.Marker>());
  const draftMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const hasFitRef = useRef(false);

  // A marker is created once and then reused, so its click handler must not
  // close over the FieldPlace it was built from — after an edit that object is
  // stale and the sheet would show the old name. Look the place up by id at
  // click time instead.
  const placesByIdRef = useRef(new Map<string, FieldPlace>());
  placesByIdRef.current = new Map(places.map((place) => [place.id, place]));

  // --- create the map once -------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const instance = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLES.dark,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      // Re-added below in compact form — Mapbox's terms require attribution to
      // stay visible. Bottom-left keeps it clear of the FABs on the right.
      attributionControl: false,
    });

    instance.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    mapRef.current = instance;
    setMap(instance);

    return () => {
      instance.remove();
      mapRef.current = null;
      setMap(null);
      markersRef.current.clear();
      draftMarkerRef.current = null;
    };
  }, []);

  // Memoised so the hook does not tear down and re-attach its map listeners on
  // every render — that would drop a press already being timed.
  const handleLongPress = useCallback(
    (lngLat: mapboxgl.LngLat) => onLongPress(lngLat.lat, lngLat.lng),
    [onLongPress]
  );
  useLongPress(map, handleLongPress);

  // --- style toggle --------------------------------------------------------
  // Markers are DOM children of the map container, not style layers, so they
  // survive setStyle untouched. Only sources and layers would need re-adding,
  // and this map has none.
  useEffect(() => {
    if (!map) return;
    map.setStyle(MAP_STYLES[styleName]);
  }, [map, styleName]);

  // --- reconcile one marker per visible place ------------------------------
  useEffect(() => {
    if (!map) return;

    const markers = markersRef.current;
    const visible = places.filter((place) => visibleKinds.has(place.kind));
    const wanted = new Set(visible.map((place) => place.id));

    for (const [id, marker] of markers) {
      if (!wanted.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    for (const place of visible) {
      let marker = markers.get(place.id);

      if (!marker) {
        const id = place.id;
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'marker';
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          const current = placesByIdRef.current.get(id);
          if (current) onSelectRef.current(current);
        });

        marker = new mapboxgl.Marker({ element }).setLngLat([place.longitude, place.latitude]);
        marker.addTo(map);
        markers.set(place.id, marker);
      } else {
        marker.setLngLat([place.longitude, place.latitude]);
      }

      const element = marker.getElement();
      element.style.setProperty('--marker-color', KIND_COLOR[place.kind]);
      element.setAttribute('aria-label', place.name);
      element.classList.toggle('is-selected', place.id === selectedId);
    }
  }, [map, places, visibleKinds, selectedId]);

  // --- frame the points on first load --------------------------------------
  useEffect(() => {
    if (!map || hasFitRef.current || places.length === 0) return;
    hasFitRef.current = true;

    const bounds = new mapboxgl.LngLatBounds();
    for (const place of places) bounds.extend([place.longitude, place.latitude]);
    map.fitBounds(bounds, { padding: 72, maxZoom: 14, duration: 0 });
  }, [map, places]);

  // --- the pin being placed ------------------------------------------------
  useEffect(() => {
    if (!map) return;

    if (!draftPoint) {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      return;
    }

    if (!draftMarkerRef.current) {
      const element = document.createElement('div');
      element.className = 'marker marker--draft';

      const marker = new mapboxgl.Marker({ element, draggable: true });
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLngLat();
        onDraftMoveRef.current(lat, lng);
      });
      marker.setLngLat([draftPoint.lng, draftPoint.lat]).addTo(map);
      draftMarkerRef.current = marker;
    } else {
      draftMarkerRef.current.setLngLat([draftPoint.lng, draftPoint.lat]);
    }
  }, [map, draftPoint]);

  // --- imperative jumps (locate me, focusing a saved point) ----------------
  useEffect(() => {
    if (!map || !focus) return;
    map.jumpTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? map.getZoom() });
  }, [map, focus?.nonce]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="map-setup">
        <div className="setup-card">
          <h2>Mapbox token missing</h2>
          <p>
            Add <code>VITE_MAPBOX_TOKEN</code> to <code>fieldmap/.env</code> and restart the dev
            server. Create a free public token (it starts with <code>pk.</code>) at{' '}
            <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noreferrer">
              account.mapbox.com
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="map" />;
}
