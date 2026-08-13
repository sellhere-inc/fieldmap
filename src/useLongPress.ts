import { useEffect } from 'react';
import type { Map as MapboxMap, LngLat, MapTouchEvent, MapMouseEvent } from 'mapbox-gl';

const HOLD_MS = 500;
/** A finger that wanders further than this was panning, not pressing. */
const SLOP_PX = 12;

/**
 * Long-press on the map, done by hand.
 *
 * Mapbox fires a `contextmenu` event, but on touch it is unreliable — some
 * mobile browsers suppress it over a canvas that is already handling gestures,
 * and where it does fire the timing differs. So touch gets an explicit timer
 * here, and `contextmenu` is kept only for right-click on desktop.
 *
 * The timer is cancelled by a second finger (that is a pinch-zoom), by movement
 * past a small slop radius (that is a pan), and by lifting early (that is a tap).
 */
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
      if (event.originalEvent.touches.length !== 1) return;

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

    const onContextMenu = (event: MapMouseEvent) => {
      event.preventDefault();
      onLongPress(event.lngLat);
    };

    map.on('touchstart', onTouchStart);
    map.on('touchmove', onTouchMove);
    map.on('touchend', cancel);
    map.on('touchcancel', cancel);
    map.on('movestart', cancel);
    map.on('contextmenu', onContextMenu);

    return () => {
      cancel();
      map.off('touchstart', onTouchStart);
      map.off('touchmove', onTouchMove);
      map.off('touchend', cancel);
      map.off('touchcancel', cancel);
      map.off('movestart', cancel);
      map.off('contextmenu', onContextMenu);
    };
  }, [map, onLongPress, enabled]);
}
