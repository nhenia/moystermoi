"use client";

/**
 * app/page.tsx
 *
 * Required dependency:
 *   npm install maplibre-gl
 *
 * Required API contracts:
 *
 * GET /api/autocomplete?q=<query>
 * {
 *   suggestions: Array<{
 *     id: string;
 *     label: string;
 *     secondaryLabel?: string;
 *   }>
 * }
 *
 * GET /api/geocode?id=<selected-suggestion-id>
 * {
 *   location: {
 *     latitude: number;
 *     longitude: number;
 *     label: string;
 *   }
 * }
 *
 * GET /api/restaurants?lat=<latitude>&lng=<longitude>&radius=<meters>
 * {
 *   restaurants: Restaurant[];
 * }
 *
 * Restaurant is defined below.
 *
 * The server must:
 * - Return real restaurant data.
 * - Validate coordinates and query parameters.
 * - Keep private API credentials server-side.
 * - Attach evidence for oyster, price, and happy-hour claims.
 * - Apply any attribution required by its data provider.
 *
 * This page deliberately does not infer current oyster stock from a menu,
 * infer happy-hour schedules, or create placeholder restaurants.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import type {
  FeatureCollection,
  Point,
} from "geojson";

import "maplibre-gl/dist/maplibre-gl.css";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Coordinates = {
  latitude: number;
  longitude: number;
};

type SearchLocation = Coordinates & {
  label: string;
  source: "device" | "address" | "map";
};

type Evidence = {
  sourceUrl: string;
  checkedAt: string;
};

type Restaurant = {
  id: string;
  name: string;
  coordinates: Coordinates;
  address: string;

  oysterOffering:
    | {
        status: "documented";
        description: string;
        evidence: Evidence;
      }
    | {
        status: "unconfirmed";
      };

  price?: {
    display: string;
    kind: "restaurant-price-level" | "oyster-price";
    evidence?: Evidence;
  };

  happyHour?: {
    description: string;
    timezone: string;
    evidence: Evidence;
  };

  operatingStatus: "open" | "closed" | "unknown";

  websiteUrl?: string;
  directionsUrl?: string;
};

type RestaurantWithDistance = Restaurant & {
  distanceMeters: number;
};

type AddressSuggestion = {
  id: string;
  label: string;
  secondaryLabel?: string;
};

type RestaurantResponse = {
  restaurants: Restaurant[];
};

type Screen = "location" | "discovery";
type Filter = "nearby" | "happy-hour" | "saved";

type MarkerProperties = {
  id: string;
  selected: boolean;
};

type StoredSession = {
  location: SearchLocation;
};

type OysterMapProps = {
  restaurants: RestaurantWithDistance[];
  location: SearchLocation;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSearchArea: (coordinates: Coordinates) => void;
};

/* -------------------------------------------------------------------------- */
/* Constants and helpers                                                      */
/* -------------------------------------------------------------------------- */

const SESSION_KEY = "moyster:session:v1";
const FAVORITES_KEY = "moyster:favorites:v1";

const INITIAL_RADIUS_METERS = 8_000;
const MAX_RADIUS_METERS = 64_000;

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
  "https://demotiles.maplibre.org/style.json";

function isCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<Coordinates>;

  return (
    typeof candidate.latitude === "number" &&
    Number.isFinite(candidate.latitude) &&
    candidate.latitude >= -90 &&
    candidate.latitude <= 90 &&
    typeof candidate.longitude === "number" &&
    Number.isFinite(candidate.longitude) &&
    candidate.longitude >= -180 &&
    candidate.longitude <= 180
  );
}

function isSearchLocation(value: unknown): value is SearchLocation {
  if (!isCoordinates(value)) return false;

  const candidate = value as Partial<SearchLocation>;

  return (
    typeof candidate.label === "string" &&
    (candidate.source === "device" ||
      candidate.source === "address" ||
      candidate.source === "map")
  );
}

function distanceMeters(a: Coordinates, b: Coordinates): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLatitude = radians(b.latitude - a.latitude);
  const dLongitude = radians(b.longitude - a.longitude);

  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);

  const h =
    Math.sin(dLatitude / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(dLongitude / 2) ** 2;

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.344;

  if (miles < 0.1) return "<0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;

  return `${Math.round(miles)} mi`;
}

function safeHttpUrl(value?: string): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function restaurantDirections(restaurant: Restaurant): string {
  const supplied = safeHttpUrl(restaurant.directionsUrl);

  if (supplied) return supplied;

  const destination =
    `${restaurant.coordinates.latitude},` +
    `${restaurant.coordinates.longitude}`;

  return (
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(destination)
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function getJSON<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? "Too many requests. Please wait a moment and try again."
        : "The service could not complete that request. Please try again.",
    );
  }

  return response.json() as Promise<T>;
}

/* -------------------------------------------------------------------------- */
/* Oyster artwork                                                             */
/* -------------------------------------------------------------------------- */

function OysterArtwork({
  className,
  decorative = true,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 360 440"
      className={className}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative}
      aria-label={decorative ? undefined : "Iridescent oyster shell"}
    >
      <defs>
        <linearGradient id="shell-outer" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d7dbad" />
          <stop offset="28%" stopColor="#b6a4d4" />
          <stop offset="55%" stopColor="#f1ead9" />
          <stop offset="78%" stopColor="#849d92" />
          <stop offset="100%" stopColor="#cab8d7" />
        </linearGradient>

        <radialGradient id="shell-inner" cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#fff9e7" />
          <stop offset="40%" stopColor="#dfcfe7" />
          <stop offset="73%" stopColor="#a6bdb2" />
          <stop offset="100%" stopColor="#676d62" />
        </radialGradient>

        <radialGradient id="shell-meat" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#f6efcc" />
          <stop offset="65%" stopColor="#c1c0a2" />
          <stop offset="100%" stopColor="#777e67" />
        </radialGradient>
      </defs>

      <path
        d="M175 24C137 17 131 48 103 62C75 75 90 107 63 127C37 147 58 175 37 199C15 225 45 245 39 273C32 303 67 311 73 340C80 369 108 365 128 394C147 421 177 402 199 412C224 422 238 389 260 384C287 377 277 343 300 325C325 306 306 282 324 254C340 230 312 210 318 182C324 152 292 146 288 117C283 89 251 93 239 65C226 34 201 42 175 24Z"
        fill="url(#shell-outer)"
        stroke="#e9e8d9"
        strokeWidth="2"
      />

      <path
        d="M176 51C145 47 141 75 118 88C94 102 102 128 82 148C64 168 79 191 61 214C47 235 69 253 65 277C62 302 90 311 96 335C103 357 126 357 144 378C162 399 183 384 202 390C222 396 234 371 252 363C272 353 264 327 282 310C302 292 287 270 301 248C313 228 290 209 295 187C300 163 274 154 270 132C265 110 242 108 229 85C215 61 197 65 176 51Z"
        fill="none"
        stroke="#555e58"
        strokeOpacity=".65"
        strokeWidth="5"
      />

      <path
        d="M178 79C142 68 117 110 106 144C94 180 77 212 87 250C96 289 111 330 146 350C180 370 221 356 247 329C276 298 279 256 274 216C269 174 249 133 224 106C211 91 196 84 178 79Z"
        fill="url(#shell-inner)"
        stroke="#fff9eb"
        strokeOpacity=".7"
        strokeWidth="3"
      />

      <path
        d="M171 169C142 161 118 185 119 215C119 240 139 247 139 271C139 299 169 316 195 305C216 296 238 271 232 246C227 225 210 221 207 198C205 180 188 173 171 169Z"
        fill="url(#shell-meat)"
        stroke="#777a64"
        strokeOpacity=".5"
        strokeWidth="2"
      />

      <path
        d="M140 202C156 181 180 184 192 200M150 283C171 297 198 285 209 265"
        fill="none"
        stroke="#fff9e9"
        strokeOpacity=".65"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Map                                                                        */
/* -------------------------------------------------------------------------- */

const OYSTER_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="60" viewBox="0 0 48 60">
  <path
    d="M24 3C17 1 15 7 11 10C6 13 9 18 5 23C1 28 5 32 4 37C3 43 9 44 11 49C13 55 19 53 23 57C28 60 32 54 36 53C41 51 39 46 43 42C47 38 43 34 45 29C47 24 42 21 42 16C41 11 35 12 32 7C30 3 27 5 24 3Z"
    fill="#171b18"
    stroke="#f1eddf"
    stroke-width="2"
  />
  <path
    d="M24 10C17 8 12 18 11 25C9 34 12 44 20 49C26 53 35 46 37 39C40 29 34 15 24 10Z"
    fill="#dad8c5"
  />
  <path
    d="M23 24C17 22 15 29 18 34C20 37 19 42 25 42C31 41 34 34 30 30C27 28 28 25 23 24Z"
    fill="#b7a8d6"
  />
</svg>
`;

function loadOysterImage(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load oyster markers."));

    image.src =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(OYSTER_MARKER_SVG);
  });
}

function OysterMap({
  restaurants,
  location,
  selectedId,
  onSelect,
  onSearchArea,
}: OysterMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const onSelectRef = useRef(onSelect);
  const restaurantsRef = useRef(restaurants);
  const locationRef = useRef(location);
  const programmaticMoveRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [movedCenter, setMovedCenter] = useState<Coordinates | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    restaurantsRef.current = restaurants;
  }, [restaurants]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [location.longitude, location.latitude],
      zoom: 12,
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
      }),
      "top-right",
    );

    map.on("error", () => {
      if (!disposed) {
        setMapError(
          "The map could not load completely. Restaurant results remain available below.",
        );
      }
    });

    map.on("moveend", () => {
      if (programmaticMoveRef.current) {
        programmaticMoveRef.current = false;
        return;
      }

      const center = map.getCenter();
      const nextCenter = {
        latitude: center.lat,
        longitude: center.lng,
      };

      setMovedCenter(
        distanceMeters(locationRef.current, nextCenter) > 750
          ? nextCenter
          : null,
      );
    });

    const handleRestaurantClick = (event: MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(event.point, {
        layers: ["oyster-restaurants"],
      })[0];

      const id = feature?.properties?.id;

      if (typeof id === "string") {
        onSelectRef.current(id);
      }
    };

    const handleClusterClick = async (event: MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(event.point, {
        layers: ["oyster-clusters"],
      })[0];

      if (!feature || feature.geometry.type !== "Point") return;

      const clusterId = Number(feature.properties?.cluster_id);
      const source = map.getSource("restaurants") as GeoJSONSource;

      try {
        const zoom = await source.getClusterExpansionZoom(clusterId);

        if (disposed) return;

        programmaticMoveRef.current = true;

        map.easeTo({
          center: feature.geometry.coordinates as [number, number],
          zoom,
          duration: 450,
        });
      } catch {
        // Keep the existing map usable if cluster expansion fails.
      }
    };

    map.on("load", async () => {
      try {
        const image = await loadOysterImage();

        if (disposed) return;

        map.addImage("oyster-symbol", image, { pixelRatio: 2 });

        map.addSource("restaurants", {
          type: "geojson",
          cluster: true,
          clusterMaxZoom: 16,
          clusterRadius: 42,
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        map.addLayer({
          id: "oyster-clusters",
          type: "circle",
          source: "restaurants",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#d8df9a",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              17,
              10,
              21,
              30,
              25,
            ],
            "circle-stroke-color": "#171b18",
            "circle-stroke-width": 2,
          },
        });

        map.addLayer({
          id: "oyster-cluster-count",
          type: "symbol",
          source: "restaurants",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
          },
          paint: {
            "text-color": "#171b18",
          },
        });

        map.addLayer({
          id: "oyster-selected-halo",
          type: "circle",
          source: "restaurants",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 24,
            "circle-color": "#c9b7ed",
            "circle-opacity": [
              "case",
              ["boolean", ["get", "selected"], false],
              0.65,
              0,
            ],
            "circle-stroke-width": [
              "case",
              ["boolean", ["get", "selected"], false],
              2,
              0,
            ],
            "circle-stroke-color": "#171b18",
          },
        });

        map.addLayer({
          id: "oyster-restaurants",
          type: "symbol",
          source: "restaurants",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": "oyster-symbol",
            "icon-size": [
              "case",
              ["boolean", ["get", "selected"], false],
              1.25,
              1,
            ],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-padding": 12,
          },
        });

        map.addSource("search-center", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Point",
              coordinates: [
                locationRef.current.longitude,
                locationRef.current.latitude,
              ],
            },
          },
        });

        map.addLayer({
          id: "search-center-dot",
          type: "circle",
          source: "search-center",
          paint: {
            "circle-radius": 5,
            "circle-color": "#171b18",
            "circle-stroke-color": "#fffaf0",
            "circle-stroke-width": 3,
          },
        });

        map.on("click", "oyster-restaurants", handleRestaurantClick);
        map.on("click", "oyster-clusters", handleClusterClick);

        for (const layer of ["oyster-restaurants", "oyster-clusters"]) {
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });

          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        }

        setReady(true);
        setMapError(null);
      } catch (error) {
        if (!disposed) {
          setMapError(errorMessage(error, "The map could not initialize."));
        }
      }
    });

    const resizeObserver = new ResizeObserver(() => map.resize());

    resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };

    // The map is initialized once. Later changes are applied through effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !ready) return;

    const source = map.getSource("restaurants") as GeoJSONSource;

    const data: FeatureCollection<Point, MarkerProperties> = {
      type: "FeatureCollection",
      features: restaurants.map((restaurant) => ({
        type: "Feature",
        properties: {
          id: restaurant.id,
          selected: restaurant.id === selectedId,
        },
        geometry: {
          type: "Point",
          coordinates: [
            restaurant.coordinates.longitude,
            restaurant.coordinates.latitude,
          ],
        },
      })),
    };

    source.setData(data);
  }, [restaurants, selectedId, ready]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !ready) return;

    const source = map.getSource("search-center") as GeoJSONSource;

    source.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Point",
        coordinates: [location.longitude, location.latitude],
      },
    });

    programmaticMoveRef.current = true;

    map.easeTo({
      center: [location.longitude, location.latitude],
      zoom: 12,
      duration: 500,
    });

    setMovedCenter(null);
  }, [location, ready]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !ready || !selectedId) return;

    const restaurant = restaurantsRef.current.find(
      (item) => item.id === selectedId,
    );

    if (!restaurant) return;

    programmaticMoveRef.current = true;

    map.easeTo({
      center: [
        restaurant.coordinates.longitude,
        restaurant.coordinates.latitude,
      ],
      // Selected restaurants should not remain hidden inside clusters.
      zoom: Math.max(map.getZoom(), 16.5),
      duration: 450,
    });
  }, [selectedId, ready]);

  function recenter() {
    const map = mapRef.current;

    if (!map) return;

    programmaticMoveRef.current = true;

    map.easeTo({
      center: [location.longitude, location.latitude],
      zoom: 12,
      duration: 450,
    });

    setMovedCenter(null);
  }

  return (
    <section className="map-section" aria-label="Oyster restaurant map">
      <div ref={containerRef} className="map-canvas" />

      <div className="map-caption" aria-hidden="true">
        THE WORLD IS YOUR OYSTER
      </div>

      {movedCenter && (
        <button
          className="search-area-button"
          onClick={() => {
            onSearchArea(movedCenter);
            setMovedCenter(null);
          }}
        >
          Search this area
        </button>
      )}

      <button
        className="recenter-button"
        onClick={recenter}
        aria-label="Recenter map on selected search location"
        title="Recenter map"
      >
        ◎
      </button>

      {mapError && (
        <div className="map-error" role="status">
          {mapError}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Main application                                                           */
/* -------------------------------------------------------------------------- */

export default function Page() {
  const [screen, setScreen] = useState<Screen>("location");
  const [hydrated, setHydrated] = useState(false);

  const [location, setLocation] = useState<SearchLocation | null>(null);
  const [pendingLocation, setPendingLocation] =
    useState<SearchLocation | null>(null);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("nearby");
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const [radius, setRadius] = useState(INITIAL_RADIUS_METERS);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const [addressOpen, setAddressOpen] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [addressResolving, setAddressResolving] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);

  const addressInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());

  const discoveryAbortRef = useRef<AbortController | null>(null);
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const locationRequestRef = useRef(0);

  const busy = loading || locating || addressResolving;

  const discover = useCallback(
    async (
      nextLocation: SearchLocation,
      nextRadius = INITIAL_RADIUS_METERS,
    ) => {
      discoveryAbortRef.current?.abort();

      const controller = new AbortController();
      discoveryAbortRef.current = controller;

      setPendingLocation(nextLocation);
      setLoading(true);
      setDiscoveryError(null);
      setLocationError(null);

      try {
        const query = new URLSearchParams({
          lat: String(nextLocation.latitude),
          lng: String(nextLocation.longitude),
          radius: String(nextRadius),
        });

        const response = await getJSON<RestaurantResponse>(
          `/api/restaurants?${query}`,
          controller.signal,
        );

        if (!Array.isArray(response.restaurants)) {
          throw new Error("The restaurant service returned an invalid response.");
        }

        const unique = new Map<string, Restaurant>();

        for (const restaurant of response.restaurants) {
          if (
            restaurant &&
            typeof restaurant.id === "string" &&
            typeof restaurant.name === "string" &&
            isCoordinates(restaurant.coordinates)
          ) {
            unique.set(restaurant.id, restaurant);
          }
        }

        if (controller.signal.aborted) return;

        setRestaurants([...unique.values()]);
        setLocation(nextLocation);
        setRadius(nextRadius);
        setSelectedId(null);
        setFilter("nearby");
        setScreen("discovery");
        setAddressOpen(false);
        setSuggestions([]);

        try {
          const session: StoredSession = { location: nextLocation };

          sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch {
          // Session persistence is optional if browser storage is unavailable.
        }
      } catch (error) {
        if (isAbortError(error)) return;

        setDiscoveryError(
          errorMessage(error, "Restaurant discovery failed. Please try again."),
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    try {
      const storedFavorites = localStorage.getItem(FAVORITES_KEY);

      if (storedFavorites) {
        const parsed: unknown = JSON.parse(storedFavorites);

        if (Array.isArray(parsed)) {
          setSavedIds(
            parsed.filter((value): value is string => typeof value === "string"),
          );
        }
      }
    } catch {
      // Continue without persisted favorites.
    }

    try {
      const storedSession = sessionStorage.getItem(SESSION_KEY);

      if (storedSession) {
        const parsed = JSON.parse(storedSession) as Partial<StoredSession>;

        if (isSearchLocation(parsed.location)) {
          void discover(parsed.location);
        }
      }
    } catch {
      // Start on location entry if the saved session is invalid.
    }

    setHydrated(true);

    return () => {
      discoveryAbortRef.current?.abort();
      autocompleteAbortRef.current?.abort();
      geocodeAbortRef.current?.abort();
      locationRequestRef.current += 1;
    };
  }, [discover]);

  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(savedIds));
    } catch {
      // Favorites still work in memory if storage is unavailable.
    }
  }, [savedIds, hydrated]);

  useEffect(() => {
    if (!addressOpen) return;

    addressInputRef.current?.focus();
  }, [addressOpen]);

  useEffect(() => {
    autocompleteAbortRef.current?.abort();

    const query = addressQuery.trim();

    if (!addressOpen || query.length < 3 || addressResolving) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    autocompleteAbortRef.current = controller;

    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      setLocationError(null);

      try {
        const response = await getJSON<{
          suggestions: AddressSuggestion[];
        }>(
          `/api/autocomplete?q=${encodeURIComponent(query)}`,
          controller.signal,
        );

        if (!controller.signal.aborted) {
          setSuggestions(
            Array.isArray(response.suggestions)
              ? response.suggestions.slice(0, 6)
              : [],
          );
        }
      } catch (error) {
        if (!isAbortError(error)) {
          setLocationError(
            errorMessage(error, "Address search is unavailable. Try again."),
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setSuggestionsLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [addressQuery, addressOpen, addressResolving]);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(null), 3500);

    return () => window.clearTimeout(timer);
  }, [notice]);

  const rankedRestaurants = useMemo<RestaurantWithDistance[]>(() => {
    if (!location) return [];

    return restaurants
      .map((restaurant) => ({
        ...restaurant,
        distanceMeters: distanceMeters(location, restaurant.coordinates),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [restaurants, location]);

  const visibleRestaurants = useMemo(() => {
    if (filter === "saved") {
      return rankedRestaurants.filter((restaurant) =>
        savedIds.includes(restaurant.id),
      );
    }

    if (filter === "happy-hour") {
      return rankedRestaurants.filter(
        (restaurant) =>
          Boolean(restaurant.happyHour?.description) &&
          Boolean(
            safeHttpUrl(restaurant.happyHour?.evidence?.sourceUrl),
          ),
      );
    }

    return rankedRestaurants;
  }, [rankedRestaurants, filter, savedIds]);

  useEffect(() => {
    if (
      selectedId &&
      !visibleRestaurants.some((restaurant) => restaurant.id === selectedId)
    ) {
      setSelectedId(null);
    }
  }, [visibleRestaurants, selectedId]);

  function selectRestaurant(id: string, fromMap = false) {
    setSelectedId(id);

    if (!fromMap) return;

    const card = cardRefs.current.get(id);
    const list = listRef.current;

    if (!card || !list) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    list.scrollTo({
      top:
        list.scrollTop +
        card.getBoundingClientRect().top -
        list.getBoundingClientRect().top -
        8,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  function toggleSaved(id: string) {
    setSavedIds((current) =>
      current.includes(id)
        ? current.filter((savedId) => savedId !== id)
        : [...current, id],
    );
  }

  function useCurrentLocation() {
    setLocationError(null);
    setDiscoveryError(null);

    if (!navigator.geolocation) {
      setLocationError(
        "This browser cannot retrieve your location. Enter an address instead.",
      );
      setAddressOpen(true);
      return;
    }

    const requestId = ++locationRequestRef.current;

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== locationRequestRef.current) return;

        setLocating(false);

        void discover({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: "Current location",
          source: "device",
        });
      },
      (error) => {
        if (requestId !== locationRequestRef.current) return;

        setLocating(false);
        setAddressOpen(true);

        setLocationError(
          error.code === 1
            ? "Location permission was denied. Enter an address instead."
            : error.code === 3
              ? "Finding your location took too long. Try again or enter an address."
              : "Your location is unavailable. Enter an address instead.",
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: 60_000,
      },
    );
  }

  async function selectAddress(suggestion: AddressSuggestion) {
    geocodeAbortRef.current?.abort();
    autocompleteAbortRef.current?.abort();

    const controller = new AbortController();
    geocodeAbortRef.current = controller;

    setAddressResolving(true);
    setLocationError(null);

    try {
      const response = await getJSON<{
        location: Coordinates & { label: string };
      }>(
        `/api/geocode?id=${encodeURIComponent(suggestion.id)}`,
        controller.signal,
      );

      if (!isCoordinates(response.location)) {
        throw new Error("That address could not be resolved. Choose another.");
      }

      if (controller.signal.aborted) return;

      setAddressQuery(suggestion.label);
      setSuggestions([]);

      await discover({
        ...response.location,
        label: response.location.label || suggestion.label,
        source: "address",
      });
    } catch (error) {
      if (!isAbortError(error)) {
        setLocationError(
          errorMessage(error, "That address could not be resolved."),
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setAddressResolving(false);
      }
    }
  }

  async function shareRestaurant(restaurant: Restaurant) {
    const url =
      safeHttpUrl(restaurant.websiteUrl) ||
      restaurantDirections(restaurant);

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${restaurant.name} — Moyster`,
          text: `Find ${restaurant.name}: ${restaurant.address}`,
          url,
        });

        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setNotice("Restaurant link copied.");
      } else {
        setNotice("Sharing is unavailable in this browser. Use Directions.");
      }
    } catch (error) {
      if (!isAbortError(error)) {
        setNotice("The restaurant could not be shared. Please try again.");
      }
    }
  }

  function openLocationEntry() {
    setLocationError(null);
    setDiscoveryError(null);
    setScreen("location");
  }

  function retryDiscovery() {
    const target = pendingLocation || location;

    if (target) {
      void discover(target, radius);
    }
  }

  const loadingLabel = locating
    ? "Finding your location"
    : addressResolving && !loading
      ? "Resolving your address"
      : "Looking for oysters";

  return (
    <main className="moyster-app">
      {screen === "location" ? (
        <section className="location-screen">
          <header className="entry-header">
            <span className="small-label">NEW ORLEANS & BEYOND</span>

            {location && (
              <button
                className="text-button"
                onClick={() => setScreen("discovery")}
                disabled={busy}
              >
                Back to map ↗
              </button>
            )}
          </header>

          <div className="entry-composition">
            <span className="edition-note">A FIELD GUIDE TO</span>

            <h1 className="wordmark">MOYSTER</h1>

            <div className="oyster-art-wrap">
              <div className="oyster-glow" />
              <OysterArtwork className="hero-oyster" />
              <span className="art-coordinate">29°57′ N / 90°04′ W</span>
            </div>

            <p className="entry-tagline">
              Good things
              <br />
              come on ice.
            </p>
          </div>

          <div className="location-controls">
            {(locationError || discoveryError) && (
              <div className="inline-error" role="alert">
                <p>{locationError || discoveryError}</p>

                {discoveryError && pendingLocation && (
                  <button
                    className="text-button"
                    onClick={retryDiscovery}
                    disabled={busy}
                  >
                    Retry search ↗
                  </button>
                )}
              </div>
            )}

            {addressOpen && (
              <div className="address-panel">
                <label className="small-label" htmlFor="address-search">
                  START ANYWHERE
                </label>

                <div className="address-input-wrap">
                  <input
                    ref={addressInputRef}
                    id="address-search"
                    type="search"
                    value={addressQuery}
                    onChange={(event) => {
                      setAddressQuery(event.target.value);
                      setLocationError(null);
                    }}
                    placeholder="Enter an address or place"
                    autoComplete="off"
                    enterKeyHint="search"
                    disabled={busy}
                    aria-describedby="address-help"
                  />

                  <button
                    className="input-close"
                    aria-label="Close address search"
                    disabled={busy}
                    onClick={() => {
                      autocompleteAbortRef.current?.abort();
                      setAddressOpen(false);
                      setSuggestions([]);
                    }}
                  >
                    ×
                  </button>
                </div>

                <p id="address-help" className="address-help">
                  Type at least 3 characters, then choose a result.
                </p>

                {suggestionsLoading && (
                  <p className="address-status" role="status">
                    Searching addresses…
                  </p>
                )}

                {suggestions.length > 0 && (
                  <ul
                    className="address-suggestions"
                    aria-label="Matching addresses"
                  >
                    {suggestions.map((suggestion) => (
                      <li key={suggestion.id}>
                        <button
                          onClick={() => void selectAddress(suggestion)}
                          disabled={busy}
                        >
                          <span>{suggestion.label}</span>

                          {suggestion.secondaryLabel && (
                            <small>{suggestion.secondaryLabel}</small>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button
              className="location-action primary-location-action"
              onClick={useCurrentLocation}
              disabled={busy}
            >
              <span>USE CURRENT LOCATION</span>
              <span aria-hidden="true">↗</span>
            </button>

            <button
              className="location-action"
              onClick={() => {
                setAddressOpen(true);
                setLocationError(null);
              }}
              disabled={busy}
            >
              <span>INPUT ADDRESS</span>
              <span aria-hidden="true">+</span>
            </button>

            <p className="entry-footer">
              No account. Just oysters.
            </p>
          </div>
        </section>
      ) : (
        <section className="discovery-screen">
          <header className="discovery-header">
            <button
              className="compact-wordmark"
              onClick={openLocationEntry}
              aria-label="Moyster: change search location"
            >
              MOYSTER
            </button>

            <button
              className="location-switch"
              onClick={openLocationEntry}
              title={location?.label}
            >
              <span>{location?.label || "Choose location"}</span>
              <span aria-hidden="true">↗</span>
            </button>
          </header>

          {location && (
            <OysterMap
              restaurants={visibleRestaurants}
              location={location}
              selectedId={selectedId}
              onSelect={(id) => selectRestaurant(id, true)}
              onSearchArea={(coordinates) => {
                void discover({
                  ...coordinates,
                  label: "Selected map area",
                  source: "map",
                });
              }}
            />
          )}

          <div className="results-toolbar">
            <div className="filters" aria-label="Filter restaurants">
              {(
                [
                  ["nearby", "Nearby"],
                  ["happy-hour", "Happy hour"],
                  ["saved", "Saved"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={filter === value ? "filter active" : "filter"}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <span className="result-count" aria-live="polite">
              {visibleRestaurants.length}
              <span className="sr-only"> restaurants</span>
            </span>
          </div>

          {discoveryError && (
            <div className="discovery-error" role="alert">
              <span>
                {discoveryError} Previous results have been preserved.
              </span>

              <button onClick={retryDiscovery}>Retry</button>
            </div>
          )}

          <div
            ref={listRef}
            className="restaurant-list"
            aria-label="Nearby oyster restaurants"
            aria-busy={loading}
          >
            {visibleRestaurants.length === 0 ? (
              <div className="empty-state">
                <span className="empty-symbol" aria-hidden="true">
                  ◌
                </span>

                <h2>
                  {filter === "saved"
                    ? "No saved spots in these results."
                    : filter === "happy-hour"
                      ? "No documented happy hours here."
                      : "No oyster results in this area."}
                </h2>

                <p>
                  {filter === "saved"
                    ? "Save a restaurant using the star on its card."
                    : filter === "happy-hour"
                      ? "A missing offer does not mean a restaurant has no happy hour."
                      : "Try widening the search or choosing another location."}
                </p>

                {filter !== "nearby" ? (
                  <button
                    className="empty-action"
                    onClick={() => setFilter("nearby")}
                  >
                    Show nearby restaurants ↗
                  </button>
                ) : (
                  <div className="empty-actions">
                    {location && radius < MAX_RADIUS_METERS && (
                      <button
                        className="empty-action"
                        onClick={() =>
                          void discover(
                            location,
                            Math.min(radius * 2, MAX_RADIUS_METERS),
                          )
                        }
                      >
                        Widen search ↗
                      </button>
                    )}

                    <button
                      className="empty-action secondary"
                      onClick={openLocationEntry}
                    >
                      Change location
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {visibleRestaurants.map((restaurant, index) => {
                  const selected = selectedId === restaurant.id;
                  const saved = savedIds.includes(restaurant.id);

                  const oysterEvidence =
                    restaurant.oysterOffering?.status === "documented"
                      ? safeHttpUrl(
                          restaurant.oysterOffering.evidence?.sourceUrl,
                        )
                      : undefined;

                  const documentedOysters =
                    restaurant.oysterOffering?.status === "documented" &&
                    Boolean(oysterEvidence);

                  const happyHourEvidence = safeHttpUrl(
                    restaurant.happyHour?.evidence?.sourceUrl,
                  );

                  const website = safeHttpUrl(restaurant.websiteUrl);

                  const showPrice =
                    Boolean(restaurant.price?.display) &&
                    (restaurant.price?.kind === "restaurant-price-level" ||
                      Boolean(
                        safeHttpUrl(restaurant.price?.evidence?.sourceUrl),
                      ));

                  return (
                    <article
                      key={restaurant.id}
                      ref={(element) => {
                        if (element) {
                          cardRefs.current.set(restaurant.id, element);
                        } else {
                          cardRefs.current.delete(restaurant.id);
                        }
                      }}
                      className={
                        selected
                          ? "restaurant-card selected"
                          : "restaurant-card"
                      }
                      aria-label={restaurant.name}
                    >
                      <button
                        className="restaurant-select"
                        aria-pressed={selected}
                        onClick={() => selectRestaurant(restaurant.id)}
                      >
                        <span className="restaurant-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <span className="restaurant-summary">
                          <span className="restaurant-heading">
                            <span className="restaurant-name">
                              {restaurant.name}
                            </span>

                            <span
                              className="restaurant-distance"
                              title="Straight-line distance from selected location"
                            >
                              {formatDistance(restaurant.distanceMeters)}
                            </span>
                          </span>

                          <span className="restaurant-meta">
                            <span
                              className={`operating-status ${
                                restaurant.operatingStatus || "unknown"
                              }`}
                            >
                              {restaurant.operatingStatus === "open"
                                ? "Open"
                                : restaurant.operatingStatus === "closed"
                                  ? "Closed"
                                  : "Hours unavailable"}
                            </span>

                            {showPrice && restaurant.price && (
                              <span>
                                {restaurant.price.kind === "oyster-price"
                                  ? "Oysters: "
                                  : "Restaurant: "}
                                {restaurant.price.display}
                              </span>
                            )}
                          </span>

                          <span className="oyster-availability">
                            {documentedOysters &&
                            restaurant.oysterOffering.status === "documented"
                              ? restaurant.oysterOffering.description
                              : "Oyster availability unconfirmed"}
                          </span>
                        </span>
                      </button>

                      <div className="restaurant-details">
                        {documentedOysters && (
                          <span className="availability-note">
                            Menu listing; current availability may vary.
                          </span>
                        )}

                        {restaurant.happyHour && happyHourEvidence && (
                          <a
                            className="happy-hour-line"
                            href={happyHourEvidence}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Schedule timezone: ${restaurant.happyHour.timezone}`}
                          >
                            <span className="happy-hour-label">
                              HAPPY HOUR
                            </span>

                            <span>
                              {restaurant.happyHour.description}
                            </span>

                            <span aria-hidden="true">↗</span>
                          </a>
                        )}

                        <p className="restaurant-address">
                          {restaurant.address}
                        </p>

                        <div className="restaurant-actions">
                          <a
                            className="directions-action"
                            href={restaurantDirections(restaurant)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Get directions to ${restaurant.name}`}
                          >
                            Directions ↗
                          </a>

                          {oysterEvidence ? (
                            <a
                              href={oysterEvidence}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View oyster menu source for ${restaurant.name}`}
                            >
                              Menu
                            </a>
                          ) : website ? (
                            <a
                              href={website}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Website
                            </a>
                          ) : null}

                          <span className="action-spacer" />

                          <button
                            aria-pressed={saved}
                            aria-label={
                              saved
                                ? `Unsave ${restaurant.name}`
                                : `Save ${restaurant.name}`
                            }
                            onClick={() => toggleSaved(restaurant.id)}
                            className={saved ? "save-action saved" : "save-action"}
                          >
                            <span aria-hidden="true">
                              {saved ? "★" : "☆"}
                            </span>
                            <span className="sr-only">
                              {saved ? "Saved" : "Save"}
                            </span>
                          </button>

                          <button
                            onClick={() => void shareRestaurant(restaurant)}
                            aria-label={`Share ${restaurant.name}`}
                          >
                            Share
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                <p className="list-footnote">
                  Distances are straight-line. Menu offerings and schedules
                  may change.
                  {filter === "saved" && " Saved view applies to this search."}
                </p>
              </>
            )}
          </div>
        </section>
      )}

      {busy && (
        <div
          className="loading-overlay"
          role="status"
          aria-live="polite"
          aria-label={loadingLabel}
        >
          <div className="loading-shell">
            <OysterArtwork className="loading-oyster" />
          </div>

          <span className="loading-title">{loadingLabel}</span>
          <span className="loading-rule" />
        </div>
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}

      <style jsx global>{`
        :root {
          color-scheme: dark;
          --ink: #171b18;
          --ink-deep: #101410;
          --paper: #f2efdf;
          --muted: #a8afa0;
          --line: rgba(242, 239, 223, 0.18);
          --acid: #dce5a0;
          --lilac: #cbb8e7;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          min-height: 100%;
          background: var(--ink-deep);
        }

        body {
          font-family: Arial, Helvetica, sans-serif;
          color: var(--paper);
          -webkit-font-smoothing: antialiased;
        }

        button,
        input,
        a {
          -webkit-tap-highlight-color: transparent;
        }

        button,
        input {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        button:disabled {
          cursor: wait;
          opacity: 0.5;
        }

        button,
        a {
          touch-action: manipulation;
        }

        a {
          color: inherit;
        }

        button:focus-visible,
        a:focus-visible,
        input:focus-visible {
          outline: 2px solid var(--lilac);
          outline-offset: 4px;
        }

        .moyster-app {
          width: 100%;
          max-width: 760px;
          height: 100dvh;
          min-height: 440px;
          margin: 0 auto;
          overflow: hidden;
          background: var(--ink);
          position: relative;
        }

        .location-screen {
          height: 100%;
          overflow-y: auto;
          padding: max(20px, env(safe-area-inset-top)) 24px
            max(18px, env(safe-area-inset-bottom));
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(
              ellipse at 60% 36%,
              rgba(178, 164, 205, 0.075),
              transparent 48%
            ),
            var(--ink);
        }

        .entry-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          min-height: 32px;
        }

        .small-label,
        .edition-note,
        .art-coordinate,
        .map-caption {
          font-family: "Courier New", monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
        }

        .small-label {
          color: var(--muted);
        }

        .text-button {
          border: 0;
          padding: 8px 0;
          color: var(--paper);
          background: none;
          font-size: 12px;
          text-align: left;
        }

        .entry-composition {
          position: relative;
          flex: 1;
          min-height: 350px;
          padding-top: 32px;
          isolation: isolate;
        }

        .edition-note {
          position: relative;
          z-index: 2;
          display: block;
          margin-bottom: 5px;
          color: var(--lilac);
        }

        .wordmark {
          position: relative;
          z-index: 2;
          margin: 0 0 0 -5px;
          font-family: Impact, "Arial Narrow", sans-serif;
          font-size: clamp(68px, 19vw, 132px);
          font-weight: 400;
          line-height: 0.9;
          letter-spacing: -0.055em;
          transform: scaleY(1.14);
          transform-origin: left top;
        }

        .oyster-art-wrap {
          position: absolute;
          top: 94px;
          right: -9px;
          width: min(75%, 320px);
          height: 315px;
          transform: rotate(19deg);
          z-index: -1;
        }

        .oyster-glow {
          position: absolute;
          inset: 18% 8%;
          border-radius: 50%;
          background: rgba(203, 184, 231, 0.15);
          filter: blur(35px);
        }

        .hero-oyster {
          width: 100%;
          height: 100%;
          filter: drop-shadow(8px 16px 16px rgba(0, 0, 0, 0.3));
        }

        .art-coordinate {
          position: absolute;
          right: -12px;
          bottom: 65px;
          color: var(--muted);
          transform: rotate(-19deg);
          writing-mode: vertical-rl;
        }

        .entry-tagline {
          position: absolute;
          left: 0;
          bottom: 9px;
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(29px, 8vw, 43px);
          font-style: italic;
          line-height: 0.96;
          letter-spacing: -0.055em;
        }

        .location-controls {
          position: relative;
          z-index: 3;
          padding-top: 18px;
        }

        .location-action {
          width: 100%;
          min-height: 62px;
          padding: 15px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 0;
          border-top: 1px solid var(--line);
          background: transparent;
          color: var(--paper);
          text-align: left;
          font-size: 13px;
          letter-spacing: 0.035em;
        }

        .primary-location-action {
          color: var(--acid);
        }

        .location-action > span:last-child {
          font-size: 27px;
          line-height: 1;
        }

        .entry-footer {
          margin: 12px 0 0;
          color: var(--muted);
          font-size: 11px;
        }

        .address-panel {
          padding: 18px 0;
          border-top: 1px solid var(--line);
          background: var(--ink);
        }

        .address-input-wrap {
          display: flex;
          align-items: center;
          margin-top: 10px;
          border-bottom: 1px solid var(--paper);
        }

        .address-input-wrap input {
          width: 100%;
          min-width: 0;
          padding: 13px 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: var(--paper);
          font-size: 16px;
        }

        .address-input-wrap input::placeholder {
          color: #a2a89c;
        }

        .input-close {
          width: 44px;
          min-height: 44px;
          border: 0;
          background: transparent;
          color: var(--paper);
          font-size: 25px;
        }

        .address-help,
        .address-status {
          color: var(--muted);
          font-size: 11px;
          line-height: 1.5;
        }

        .address-suggestions {
          max-height: 240px;
          overflow-y: auto;
          margin: 10px 0 0;
          padding: 0;
          list-style: none;
        }

        .address-suggestions li + li {
          border-top: 1px solid var(--line);
        }

        .address-suggestions button {
          width: 100%;
          min-height: 48px;
          padding: 12px 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
          border: 0;
          background: transparent;
          color: var(--paper);
          text-align: left;
          font-size: 13px;
        }

        .address-suggestions small {
          color: var(--muted);
          font-size: 11px;
        }

        .inline-error {
          padding: 12px 0;
          color: #f0c9bd;
          font-size: 12px;
          line-height: 1.5;
        }

        .inline-error p {
          margin: 0;
        }

        .discovery-screen {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .discovery-header {
          min-height: calc(58px + env(safe-area-inset-top));
          padding: max(10px, env(safe-area-inset-top)) 18px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-shrink: 0;
        }

        .compact-wordmark {
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--paper);
          font-family: Impact, "Arial Narrow", sans-serif;
          font-size: 31px;
          font-weight: 400;
          letter-spacing: -0.045em;
          line-height: 1;
        }

        .location-switch {
          display: flex;
          align-items: center;
          gap: 8px;
          max-width: 50%;
          min-height: 40px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--acid);
          font-size: 11px;
        }

        .location-switch span:first-child {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .location-switch span:last-child {
          font-size: 19px;
        }

        .map-section {
          position: relative;
          height: clamp(210px, 44dvh, 430px);
          flex-shrink: 0;
          overflow: hidden;
          background: #dce0d3;
          color: var(--ink);
        }

        .map-canvas {
          width: 100%;
          height: 100%;
        }

        .map-caption {
          position: absolute;
          top: 14px;
          left: 14px;
          max-width: calc(100% - 70px);
          padding: 6px 8px;
          background: rgba(242, 239, 223, 0.9);
          pointer-events: none;
          font-size: 9px;
        }

        .recenter-button {
          position: absolute;
          right: 12px;
          bottom: 35px;
          width: 42px;
          height: 42px;
          border: 1px solid var(--ink);
          border-radius: 50%;
          background: var(--paper);
          color: var(--ink);
          font-size: 28px;
          line-height: 1;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        }

        .search-area-button {
          position: absolute;
          bottom: 35px;
          left: 50%;
          transform: translateX(-50%);
          min-height: 40px;
          padding: 0 16px;
          border: 1px solid var(--ink);
          border-radius: 0;
          background: var(--acid);
          color: var(--ink);
          font-size: 12px;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        }

        .map-error {
          position: absolute;
          left: 10px;
          right: 10px;
          bottom: 83px;
          padding: 10px;
          background: var(--paper);
          color: var(--ink);
          font-size: 11px;
          line-height: 1.4;
        }

        .maplibregl-ctrl-group {
          border-radius: 0;
        }

        .maplibregl-ctrl-attrib {
          font-size: 9px;
        }

        .results-toolbar {
          min-height: 53px;
          padding: 0 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid var(--line);
          flex-shrink: 0;
        }

        .filters {
          display: flex;
          align-items: stretch;
          gap: 22px;
          min-width: 0;
        }

        .filter {
          position: relative;
          min-height: 52px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--muted);
          font-size: 12px;
          white-space: nowrap;
        }

        .filter.active {
          color: var(--acid);
        }

        .filter.active::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 2px;
          background: var(--acid);
        }

        .result-count {
          color: var(--muted);
          font-family: "Courier New", monospace;
          font-size: 12px;
        }

        .restaurant-list {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding-bottom: env(safe-area-inset-bottom);
          scrollbar-width: thin;
          scrollbar-color: #596150 var(--ink);
        }

        .restaurant-card {
          border-bottom: 1px solid var(--line);
          transition: background 160ms ease;
        }

        .restaurant-card.selected {
          background: rgba(203, 184, 231, 0.09);
          box-shadow: inset 3px 0 0 var(--lilac);
        }

        .restaurant-select {
          width: 100%;
          padding: 17px 18px 0;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          border: 0;
          background: transparent;
          color: var(--paper);
          text-align: left;
        }

        .restaurant-index {
          width: 19px;
          padding-top: 3px;
          flex-shrink: 0;
          color: var(--muted);
          font-family: "Courier New", monospace;
          font-size: 10px;
        }

        .restaurant-summary {
          display: block;
          width: 100%;
          min-width: 0;
        }

        .restaurant-heading {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }

        .restaurant-name {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 21px;
          font-weight: 400;
          line-height: 1.1;
          letter-spacing: -0.045em;
          overflow-wrap: anywhere;
        }

        .restaurant-distance {
          flex-shrink: 0;
          color: var(--acid);
          font-family: "Courier New", monospace;
          font-size: 11px;
          white-space: nowrap;
        }

        .restaurant-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 5px 13px;
          margin-top: 7px;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.4;
        }

        .operating-status.open {
          color: var(--acid);
        }

        .operating-status.closed {
          color: #d3b4a5;
        }

        .oyster-availability {
          display: block;
          margin-top: 6px;
          color: var(--paper);
          font-size: 12px;
          line-height: 1.4;
        }

        .restaurant-details {
          padding: 0 18px 8px 49px;
        }

        .availability-note {
          display: block;
          margin-top: 3px;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.4;
        }

        .happy-hour-line {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-top: 9px;
          color: var(--lilac);
          font-size: 11px;
          line-height: 1.5;
          text-decoration: none;
        }

        .happy-hour-label {
          flex-shrink: 0;
          font-family: "Courier New", monospace;
          font-size: 9px;
          letter-spacing: 0.02em;
        }

        .restaurant-address {
          margin: 7px 0 0;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.4;
        }

        .restaurant-actions {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 43px;
        }

        .restaurant-actions a,
        .restaurant-actions button {
          min-height: 44px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          background: transparent;
          color: var(--muted);
          font-size: 11px;
          text-decoration: none;
        }

        .restaurant-actions .directions-action {
          color: var(--paper);
        }

        .action-spacer {
          flex: 1;
        }

        .restaurant-actions .save-action {
          min-width: 38px;
          font-size: 24px;
        }

        .restaurant-actions .save-action.saved {
          color: var(--acid);
        }

        .list-footnote {
          margin: 0;
          padding: 18px;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.5;
        }

        .discovery-error {
          padding: 10px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid var(--line);
          color: #f0c9bd;
          font-size: 11px;
          line-height: 1.4;
        }

        .discovery-error button {
          min-height: 36px;
          border: 0;
          background: transparent;
          color: var(--paper);
          text-decoration: underline;
        }

        .empty-state {
          padding: 24px;
        }

        .empty-symbol {
          color: var(--lilac);
          font-size: 40px;
          line-height: 1;
        }

        .empty-state h2 {
          max-width: 300px;
          margin: 12px 0 8px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 25px;
          font-weight: 400;
          line-height: 1.1;
          letter-spacing: -0.04em;
        }

        .empty-state p {
          max-width: 320px;
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .empty-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 18px;
        }

        .empty-action {
          min-height: 44px;
          margin-top: 10px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--acid);
          font-size: 12px;
        }

        .empty-action.secondary {
          color: var(--paper);
        }

        .loading-overlay {
          position: absolute;
          inset: 0;
          z-index: 100;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(16, 20, 16, 0.94);
          backdrop-filter: blur(8px);
        }

        .loading-shell {
          width: 112px;
          height: 140px;
          animation: shell-float 1.8s ease-in-out infinite;
        }

        .loading-oyster {
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 0 22px rgba(203, 184, 231, 0.2));
        }

        .loading-title {
          margin-top: 22px;
          color: var(--paper);
          font-family: "Courier New", monospace;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-align: center;
          text-transform: uppercase;
        }

        .loading-rule {
          width: 96px;
          height: 2px;
          margin-top: 16px;
          overflow: hidden;
          background: rgba(242, 239, 223, 0.15);
          position: relative;
        }

        .loading-rule::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            transparent,
            var(--lilac),
            var(--acid),
            transparent
          );
          animation: loading-shimmer 1.3s linear infinite;
        }

        .toast {
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: max(20px, env(safe-area-inset-bottom));
          z-index: 110;
          padding: 14px 16px;
          border: 1px solid var(--ink);
          background: var(--acid);
          color: var(--ink);
          font-size: 12px;
          line-height: 1.4;
          box-shadow: 0 5px 25px rgba(0, 0, 0, 0.25);
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        @keyframes shell-float {
          0%,
          100% {
            transform: translateY(0) rotate(-8deg);
          }

          50% {
            transform: translateY(-8px) rotate(8deg);
          }
        }

        @keyframes loading-shimmer {
          from {
            transform: translateX(-100%);
          }

          to {
            transform: translateX(100%);
          }
        }

        @media (min-width: 600px) {
          .location-screen {
            padding-left: 40px;
            padding-right: 40px;
          }

          .entry-composition {
            min-height: 430px;
          }

          .oyster-art-wrap {
            top: 105px;
            right: 30px;
            width: 350px;
            height: 380px;
          }

          .entry-tagline {
            font-size: 46px;
          }

          .restaurant-name {
            font-size: 24px;
          }
        }

        @media (max-height: 700px) {
          .entry-composition {
            min-height: 280px;
            padding-top: 22px;
          }

          .oyster-art-wrap {
            top: 70px;
            height: 250px;
          }

          .entry-tagline {
            font-size: 29px;
          }

          .map-section {
            height: 37dvh;
            min-height: 165px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </main>
  );
}
