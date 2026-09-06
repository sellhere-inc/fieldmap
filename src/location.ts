export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

/** Retry without requiring high accuracy when GPS is unavailable or slow. */
export async function requestLocation(geolocation: Geolocation): Promise<UserLocation> {
  const locate = (enableHighAccuracy: boolean) => new Promise<GeolocationPosition>((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy, timeout: 15000, maximumAge: 0,
    });
  });
  let position: GeolocationPosition;
  try {
    position = await locate(true);
  } catch (error) {
    const code = locationErrorCode(error);
    if (code !== 2 && code !== 3) throw error;
    position = await locate(false);
  }
  const { latitude: lat, longitude: lng, accuracy } = position.coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(accuracy)
    || Math.abs(lat) > 90 || Math.abs(lng) > 180 || accuracy < 0) {
    throw new Error('Your device returned an invalid location. Please try again.');
  }
  return { lat, lng, accuracy };
}

function locationErrorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
}

export function locationErrorMessage(error: unknown): string {
  switch (locationErrorCode(error)) {
    case 1: return 'Location access is blocked. Allow location for this site in your browser settings, then try again.';
    case 2: return 'Your device could not determine your location. Turn on Location Services and try again.';
    case 3: return 'Finding your location timed out. Try again where your device can get a better signal.';
    default: return error instanceof Error ? error.message : 'Could not find your location. Please try again.';
  }
}
