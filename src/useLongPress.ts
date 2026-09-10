import { useEffect } from 'react';
import type { Map as MapboxMap, LngLat, MapTouchEvent } from 'mapbox-gl';

const HOLD_MS = 500;
/** A finger that wanders further than this was panning, not pressing. */
const SLOP_PX = 12;

/** Touch-only long press on mobile. Mouse and context-menu gestures never add pins.
 * Cancel when the user pans, pinches, lifts their finger, or the map moves. */
export function useLongPress(
  map: MapboxMap | null,
  onLongPress: (lngLat: LngLat) => void,
  enabled = true
): void {
  useEffect(() => {
    if (!map || !enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let startX = 0;
    let startY = 0;

    const cancel = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const onTouchStart = (event: MapTouchEvent) => {
      cancel();
      if (!window.matchMedia('(pointer: coarse)').matches || event.originalEvent.touches.length !== 1) return;

      const { lngLat, point } = event;
      startX = point.x;
      startY = point.y;

      timer = setTimeout(() => {
        timer = null;
        // A real press deserves feedback on a device with no cursor.
        navigator.vibrate?.(15);
        onLongPress(lngLat);
      }, HOLD_MS);
    };

    const onTouchMove = (event: MapTouchEvent) => {
      if (timer === null) return;
      const dx = event.point.x - startX;
      const dy = event.point.y - startY;
      if (Math.hypot(dx, dy) > SLOP_PX) cancel();
    };

    map.on('touchstart', onTouchStart);
    map.on('touchmove', onTouchMove);
    map.on('touchend', cancel);
    map.on('touchcancel', cancel);
    map.on('movestart', cancel);

    return () => {
      cancel();
      map.off('touchstart', onTouchStart);
      map.off('touchmove', onTouchMove);
      map.off('touchend', cancel);
      map.off('touchcancel', cancel);
      map.off('movestart', cancel);
    };
  }, [map, onLongPress, enabled]);
}
