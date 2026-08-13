import { GOOGLE_MAPS_API_KEY } from "./googleMap3dConfig";

/**
 * Loads the Google Maps JavaScript API asynchronously. Resolves once the
 * `google.maps` namespace is available, or immediately if already loaded.
 */
export function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return;
    if (window.google?.maps?.Map) {
      resolve();
      return;
    }

    const existing = document.getElementById("gmaps-script");
    if (existing) {
      const poll = setInterval(() => {
        if (window.google?.maps?.Map) {
          clearInterval(poll);
          resolve();
        }
      }, 50);
      return;
    }

    const script = document.createElement("script");
    script.id = "gmaps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=beta`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
}