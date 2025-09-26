"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import type { Feature, FeatureCollection, LineString, Geometry } from 'geojson';
import "mapbox-gl/dist/mapbox-gl.css";
import config from "@/config/config";
import { getGeocoder } from '@/services/geocoding';
import { computeBearing, stepBearingTowards, distanceMeters } from './geo';
import { createPinElement } from './pinMarker';
import { formatDuration, formatDistance, formatInstructionVI, renderInstructionPopupHTML } from './formatters';
import { pickManeuverIcon } from './maneuvers';
import { Toolbar } from './Toolbar';
import { ControlsPanel } from './ControlsPanel';
import { GuidanceHUD } from './GuidanceHUD';
import { SimulationPanel } from './SimulationPanel';

export default function RoutingMap() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [is3D, setIs3D] = useState(true);
    const [angled, setAngled] = useState(true);
    const [courseUp] = useState(true);
    // Routing state
    type Profile = 'driving' | 'walking' | 'cycling';
    const routeSourceId = 'route-line';
    const stepSourceId = 'step-line';
    const routeDataRef = useRef<FeatureCollection<Geometry> | null>(null);
    const stepDataRef = useRef<FeatureCollection<Geometry> | null>(null);
    const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const viaMarkersRef = useRef<mapboxgl.Marker[]>([]);
    const currentPinMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const vehicleMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const vehicleElRef = useRef<HTMLDivElement | null>(null);
    const stepMarkersRef = useRef<mapboxgl.Marker[]>([]);
    const openStepPopupRef = useRef<mapboxgl.Popup | null>(null);
    const stepPopupsRef = useRef<mapboxgl.Popup[]>([]);
    // Simulation refs
    const simMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const simRAFRef = useRef<number | null>(null);
    const simCoordsRef = useRef<[number, number][]>([]);
    const simCumDistRef = useRef<number[]>([]);
    const simTotalDistRef = useRef<number>(0);
    const simDistRef = useRef<number>(0);
    const lastTsRef = useRef<number | null>(null);
    const simLockedZoomRef = useRef<number | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [startPoint, setStartPoint] = useState<{ lat: number; lng: number } | null>({ lat: 21.0278, lng: 105.8342 });
    const [endPoint, setEndPoint] = useState<{ lat: number; lng: number } | null>({ lat: 21.0378, lng: 105.8442 });
    const [waypoints, setWaypoints] = useState<Array<{ lat: number; lng: number }>>([]);
    const [profile, setProfile] = useState<Profile>('driving');
    const [instructions, setInstructions] = useState<any[]>([]);
    const [isRouting, setIsRouting] = useState(false);
    const [routeSummary, setRouteSummary] = useState<{ distanceKm: number; durationMin: number } | null>(null);
    const [activeStepIdx, setActiveStepIdx] = useState<number | null>(null);
    const [guidanceMode, setGuidanceMode] = useState<boolean>(false);
    const [headingDeg, setHeadingDeg] = useState<number>(0);
    const [keepZoom, setKeepZoom] = useState<boolean>(false);
    const smoothTurns = true;
    const maxTurnRateDegPerSecRef = useRef<number>(60);
    const [showAllPopups, setShowAllPopups] = useState<boolean>(true);
    // Display labels for picked/search points
    const [startLabel, setStartLabel] = useState<string>("");
    const [endLabel, setEndLabel] = useState<string>("");
    const [waypointLabels, setWaypointLabels] = useState<string[]>([]);
    // Simulation UI state
    const [simPlaying, setSimPlaying] = useState<boolean>(false);
    const [simSpeed, setSimSpeed] = useState<number>(1);
    const [simFollow, setSimFollow] = useState<boolean>(true);
    // Simulation metrics & step tracking
    const [simRemainingM, setSimRemainingM] = useState<number>(0);
    const [simEtaSec, setSimEtaSec] = useState<number>(0);
    const [simToNextManeuverM, setSimToNextManeuverM] = useState<number>(0);
    const stepStartCumRef = useRef<number[]>([]); // per-step start cumulative distance (m)
    const stepEndCumRef = useRef<number[]>([]);   // per-step end cumulative distance (m)
    const stepFirstCoordIndexRef = useRef<number[]>([]); // index of first coord of each step in route coords
    const stepMetersRef = useRef<number[]>([]);   // per-step length in meters
    const stepDurationSecRef = useRef<number[]>([]); // per-step duration in seconds (from API)
    const stepCumDurEndRef = useRef<number[]>([]); // cumulative duration to end of each step (sec)
    const routeTotalDurationSecRef = useRef<number>(0);
    const nextStepIdxRef = useRef<number>(0);
    const lastPassedPopupRef = useRef<mapboxgl.Popup | null>(null);
    const nextPopupRef = useRef<mapboxgl.Popup | null>(null);
    const geoWatchIdRef = useRef<number | null>(null);
    const courseUpRef = useRef<boolean>(false);
    const cameraBearingRef = useRef<number>(0);
    const lastGuidanceTsRef = useRef<number | null>(null);
    const autoAdvanceThresholdM = 25;
    // Map picking state (choose a point on map for start/end/waypoint)
    type PickTarget = { type: 'start' } | { type: 'end' } | { type: 'via'; index: number };
    const pickingRef = useRef<{ target: PickTarget; handler: (e: mapboxgl.MapMouseEvent) => void } | null>(null);

    // keep ref in sync with state
    useEffect(() => {
        courseUpRef.current = courseUp;
    }, [courseUp]);

    const toLngLat = (p: { lat: number; lng: number }) => [p.lng, p.lat] as [number, number];
    // moved helpers to ./formatters, ./geo, ./maneuvers

    // Reverse geocoding helper to get a human-friendly place name from coordinates
    const reverseGeocode = useCallback(async (lng: number, lat: number): Promise<string | null> => {
        try {
            const gc = getGeocoder();
            if (gc.reverse) return await gc.reverse(lng, lat);
            // fallback to Mapbox if provider has no reverse
            const token = config.mapbox?.accessToken || (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string) || "";
            if (!token) return null;
            const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?limit=1&language=vi&access_token=${encodeURIComponent(token)}`;
            const res = await fetch(url);
            const data = await res.json();
            return data?.features?.[0]?.place_name ?? null;
        } catch { return null; }
    }, []);

    const updateStartLabelFrom = useCallback(async (lng: number, lat: number) => {
        const name = await reverseGeocode(lng, lat);
        setStartLabel(name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }, [reverseGeocode]);

    const updateEndLabelFrom = useCallback(async (lng: number, lat: number) => {
        const name = await reverseGeocode(lng, lat);
        setEndLabel(name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }, [reverseGeocode]);

    const updateWaypointLabelFrom = useCallback(async (index: number, lng: number, lat: number) => {
        const name = await reverseGeocode(lng, lat);
        setWaypointLabels((prev) => {
            const next = prev.slice();
            next[index] = name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            return next;
        });
    }, [reverseGeocode]);

    // Keep waypointLabels array length in sync with waypoints
    useEffect(() => {
        setWaypointLabels((prev) => {
            const next = [...prev];
            if (next.length !== waypoints.length) {
                next.length = waypoints.length;
            }
            return next.map((v) => v ?? "");
        });
    }, [waypoints.length]);

    const positionAtDistance = useCallback((dist: number): { pos: [number, number]; bearing: number } | null => {
        const coords = simCoordsRef.current;
        const cums = simCumDistRef.current;
        if (!coords || coords.length < 2 || cums.length < 2) return null;
        if (dist <= 0) {
            const [lon1, lat1] = coords[0];
            const [lon2, lat2] = coords[1];
            return { pos: coords[0], bearing: computeBearing(lat1, lon1, lat2, lon2) };
        }
        if (dist >= simTotalDistRef.current) {
            const n = coords.length;
            const [lon1, lat1] = coords[n - 2];
            const [lon2, lat2] = coords[n - 1];
            return { pos: coords[n - 1], bearing: computeBearing(lat1, lon1, lat2, lon2) };
        }
        // find segment where cumulative >= dist
        let i = 1;
        while (i < cums.length && cums[i] < dist) i++;
        const prevD = cums[i - 1];
        const segLen = cums[i] - prevD;
        const t = segLen > 0 ? (dist - prevD) / segLen : 0;
        const [lon1, lat1] = coords[i - 1];
        const [lon2, lat2] = coords[i];
        const lon = lon1 + (lon2 - lon1) * t;
        const lat = lat1 + (lat2 - lat1) * t;
        const br = computeBearing(lat1, lon1, lat2, lon2);
        return { pos: [lon, lat], bearing: br };
    }, []);

    // maneuver helpers moved to ./maneuvers

    const computeManeuverRotation = (step: any): number => {
        try {
            const modifier = (step?.maneuver?.modifier || '').toLowerCase();
            let incomingBearing: number | null = null;
            if (Array.isArray(instructions) && instructions.length > 0) {
                const idx = instructions.findIndex((s) => s === step);
                if (idx > 0) {
                    const prev = instructions[idx - 1];
                    const coords = prev?.geometry?.coordinates as [number, number][] | undefined;
                    if (coords && coords.length >= 2) {
                        const [lon1, lat1] = coords[coords.length - 2];
                        const [lon2, lat2] = coords[coords.length - 1];
                        incomingBearing = computeBearing(lat1, lon1, lat2, lon2);
                    }
                }
            }
            if (incomingBearing == null && step?.geometry?.coordinates?.length >= 2) {
                const [lon1, lat1] = step.geometry.coordinates[0];
                const [lon2, lat2] = step.geometry.coordinates[1];
                incomingBearing = computeBearing(lat1, lon1, lat2, lon2);
            }
            const base = incomingBearing ?? 0;
            return base;
        } catch {
            return 0;
        }
    };

    const enable3D = useCallback((map: mapboxgl.Map) => {
        if (!map.getSource("mapbox-dem")) {
            map.addSource("mapbox-dem", {
                type: "raster-dem",
                url: "mapbox://mapbox.terrain-rgb",
                tileSize: 512,
                maxzoom: 14,
            } as any);
        }
        try {
            (map as any).setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
        } catch { }

        if (!map.getLayer("sky")) {
            map.addLayer({
                id: "sky",
                type: "sky",
                paint: {
                    "sky-type": "atmosphere",
                    "sky-atmosphere-sun": [0.0, 0.0],
                    "sky-atmosphere-sun-intensity": 15,
                },
            } as any);
        }

        const layers = map.getStyle().layers || [];
        const labelLayerId = layers.find(
            (l) => l.type === "symbol" && (l.layout as any)?.["text-field"]
        )?.id;

        if (!map.getLayer("3d-buildings")) {
            map.addLayer(
                {
                    id: "3d-buildings",
                    source: "composite",
                    "source-layer": "building",
                    filter: ["has", "height"],
                    type: "fill-extrusion",
                    minzoom: 15,
                    paint: {
                        "fill-extrusion-color": "#aaa",
                        "fill-extrusion-height": ["get", "height"],
                        "fill-extrusion-base": ["get", "min_height"],
                        "fill-extrusion-opacity": 0.6,
                    },
                } as any,
                labelLayerId
            );
        }
    }, []);

    const disable3D = useCallback((map: mapboxgl.Map) => {
        try {
            (map as any).setTerrain(null);
        } catch { }
        if (map.getLayer("3d-buildings")) {
            map.removeLayer("3d-buildings");
        }
        if (map.getLayer("sky")) {
            map.removeLayer("sky");
        }
        if (map.getSource("mapbox-dem")) {
            map.removeSource("mapbox-dem");
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!mapContainer.current || mapRef.current) return;

        const token = config.mapbox?.accessToken ?? "";
        if (!token) {
            setError(
                "Thiếu Mapbox access token. Hãy đặt biến môi trường NEXT_PUBLIC_MAPBOX_TOKEN."
            );
            return;
        }

        mapboxgl.accessToken = token;
        try {
            mapRef.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: config.mapbox?.style || "mapbox://styles/mapbox/streets-v12",
                center: [
                    (config.mapDefaults?.defaultCenterLng as number) ?? 105.8194,
                    (config.mapDefaults?.defaultCenterLat as number) ?? 21.0227,
                ],
                zoom: (config.mapDefaults?.defaultZoom as number) ?? 13,
                pitch: 70,
                bearing: -17.6,
                antialias: true,
                cooperativeGestures: false,
            });

            mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");
            mapRef.current.addControl(new mapboxgl.FullscreenControl(), "top-right");
            mapRef.current.addControl(new mapboxgl.ScaleControl({ unit: "metric" }));

            mapRef.current.dragRotate.enable();
            mapRef.current.touchZoomRotate.enableRotation();

            const maybeApply3D = () => {
                if (!mapRef.current) return;
                if (is3D) enable3D(mapRef.current);
                if (angled) {
                    mapRef.current.easeTo({ pitch: 55, bearing: -17.6, duration: 500 });
                } else {
                    mapRef.current.easeTo({ pitch: 0, bearing: 0, duration: 300 });
                }
            };
            const onLoaded = () => {
                if (!mapRef.current) return;
                if (!mapRef.current.getSource(routeSourceId)) {
                    mapRef.current.addSource(routeSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                    if (!mapRef.current.getLayer('route-line-casing')) {
                        mapRef.current.addLayer({
                            id: 'route-line-casing',
                            type: 'line',
                            source: routeSourceId,
                            paint: {
                                'line-color': '#60a5fa',
                                'line-width': [
                                    'interpolate',
                                    ['linear'],
                                    ['zoom'],
                                    10, 6,
                                    14, 12,
                                    18, 26
                                ],
                                'line-opacity': 0.45,
                                'line-blur': 0.3
                            },
                            layout: { 'line-cap': 'round', 'line-join': 'round' }
                        });
                    }
                    mapRef.current.addLayer({
                        id: 'route-line-layer',
                        type: 'line',
                        source: routeSourceId,
                        paint: {
                            'line-color': '#1d4ed8',
                            'line-width': [
                                'interpolate',
                                ['linear'],
                                ['zoom'],
                                10, 4.5,
                                13, 7,
                                16, 12,
                                19, 24
                            ],
                            'line-opacity': 0.95,
                            'line-blur': 0.15
                        },
                        layout: { 'line-cap': 'round', 'line-join': 'round' }
                    });
                }
                if (!mapRef.current.getSource(stepSourceId)) {
                    mapRef.current.addSource(stepSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                    mapRef.current.addLayer({
                        id: 'step-line-layer',
                        type: 'line',
                        source: stepSourceId,
                        paint: {
                            'line-color': '#f97316',
                            'line-width': [
                                'interpolate',
                                ['linear'],
                                ['zoom'],
                                10, 6,
                                13, 9,
                                16, 14,
                                19, 26
                            ],
                            'line-opacity': 0.98,
                            'line-blur': 0.05
                        },
                        layout: { 'line-cap': 'round', 'line-join': 'round' }
                    });
                }
                try {
                    if (routeDataRef.current) (mapRef.current.getSource(routeSourceId) as mapboxgl.GeoJSONSource)?.setData(routeDataRef.current);
                    if (stepDataRef.current) (mapRef.current.getSource(stepSourceId) as mapboxgl.GeoJSONSource)?.setData(stepDataRef.current);
                } catch { }
                setMapReady(true);
                maybeApply3D();
                try {
                    if (courseUpRef.current && routeDataRef.current) {
                        const routeGeom = routeDataRef.current.features?.[0]?.geometry as any;
                        const coords: [number, number][] | undefined = routeGeom?.coordinates;
                        if (coords && coords.length >= 2) {
                            const [lon1, lat1] = coords[0];
                            const [lon2, lat2] = coords[1];
                            const br = computeBearing(lat1, lon1, lat2, lon2);
                            setHeadingDeg(br);
                            cameraBearingRef.current = br;
                            mapRef.current?.easeTo({ bearing: br, pitch: Math.max(mapRef.current.getPitch(), 50), duration: 300 });
                        }
                    }
                } catch { }
            };
            mapRef.current.on("load", onLoaded);
            mapRef.current.on("style.load", onLoaded);
            mapRef.current.on("load", () => {
                try { cameraBearingRef.current = mapRef.current!.getBearing(); } catch { }
            });
        } catch (e: any) {
            setError(e?.message || "Không thể khởi tạo bản đồ Mapbox");
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    const rotateBy = useCallback((delta: number) => {
        if (!mapRef.current) return;
        const current = mapRef.current.getBearing();
        mapRef.current.rotateTo(current + delta, { duration: 300 });
    }, []);

    const resetNorth = useCallback(() => {
        if (!mapRef.current) return;
        mapRef.current.resetNorth({ duration: 300 });
    }, []);

    const endPicking = useCallback(() => {
        if (!mapRef.current) return;
        if (pickingRef.current) {
            mapRef.current.off('click', pickingRef.current.handler as any);
            pickingRef.current = null;
        }
        try { mapRef.current.getCanvas().style.cursor = ''; } catch { }
    }, []);

    const beginPicking = useCallback((target: PickTarget) => {
        if (!mapRef.current) return;
        endPicking();
        try { mapRef.current.getCanvas().style.cursor = 'crosshair'; } catch { }
        const handler = async (e: mapboxgl.MapMouseEvent) => {
            const { lng, lat } = e.lngLat;
            if (target.type === 'start') {
                setStartPoint({ lat, lng });
                await updateStartLabelFrom(lng, lat);
            } else if (target.type === 'end') {
                setEndPoint({ lat, lng });
                await updateEndLabelFrom(lng, lat);
            } else {
                const idx = target.index;
                const next = [...waypoints];
                next[idx] = { lat, lng };
                setWaypoints(next);
                await updateWaypointLabelFrom(idx, lng, lat);
            }
            endPicking();
        };
        pickingRef.current = { target, handler };
        mapRef.current.on('click', handler as any);
    }, [endPicking, setStartPoint, setEndPoint, waypoints, setWaypoints, updateStartLabelFrom, updateEndLabelFrom, updateWaypointLabelFrom]);

    // When start/end/waypoints change (from search, typing, or programmatically), try to populate labels
    useEffect(() => {
        if (startPoint) updateStartLabelFrom(startPoint.lng, startPoint.lat);
    }, [startPoint?.lat, startPoint?.lng, updateStartLabelFrom]);

    useEffect(() => {
        if (endPoint) updateEndLabelFrom(endPoint.lng, endPoint.lat);
    }, [endPoint?.lat, endPoint?.lng, updateEndLabelFrom]);

    useEffect(() => {
        waypoints.forEach((wp, idx) => {
            if (!waypointLabels[idx] || waypointLabels[idx] === '') {
                updateWaypointLabelFrom(idx, wp.lng, wp.lat);
            }
        });
    }, [waypoints, waypointLabels, updateWaypointLabelFrom]);

    // Use external helper to create pin elements
    const create3DPinElement = useCallback((color: string = '#ef4444', number?: number) => createPinElement(color, number), []);

    const set3DPinAt = useCallback((lng: number, lat: number, color: string = '#ef4444') => {
        if (!mapRef.current) return;
        const el = create3DPinElement(color);
        if (currentPinMarkerRef.current) {
            currentPinMarkerRef.current.remove();
            currentPinMarkerRef.current = null;
        }
        currentPinMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' as any })
            .setLngLat([lng, lat])
            .addTo(mapRef.current);

        const currentZoom = mapRef.current.getZoom();
        const targetZoom = keepZoom ? currentZoom : Math.max(currentZoom, 17);
        const targetPitch = Math.max(mapRef.current.getPitch(), 60);
        mapRef.current.easeTo({ center: [lng, lat], zoom: targetZoom, pitch: targetPitch, duration: 600 });
    }, [create3DPinElement, keepZoom]);

    const focusOnCoordinate = useCallback((coords: { lat: number; lng: number }) => {
        if (!mapRef.current) return;
        const { lat, lng } = coords;
        const currentZoom = mapRef.current.getZoom();
        const targetZoom = keepZoom ? currentZoom : Math.max(currentZoom, 16.5);
        mapRef.current.easeTo({ center: [lng, lat], zoom: targetZoom, duration: 450 });
    }, [keepZoom]);

    const createVehicleElement = useCallback((color: string = '#0ea5e9') => {
        const el = document.createElement('div');
        el.style.width = '36px';
        el.style.height = '36px';
        el.style.borderRadius = '50%';
        el.style.background = 'linear-gradient(180deg, rgba(20,20,20,0.9), rgba(20,20,20,0.6))';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.boxShadow = '0 6px 12px rgba(0,0,0,0.35)';
        el.style.backdropFilter = 'blur(2px)';
        el.style.transform = 'translateY(-4px)';
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '22');
        svg.setAttribute('height', '22');
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M12 2 L18 20 L12 16 L6 20 Z');
        path.setAttribute('fill', color);
        svg.appendChild(path);
        el.appendChild(svg);
        return el;
    }, []);

    // Robust geolocation handler for "Pin my location"
    const handlePinMyLocation = useCallback(async () => {
        try {
            if (typeof window === 'undefined') return;
            if (!('geolocation' in navigator)) {
                alert('Thiết bị hoặc trình duyệt không hỗ trợ định vị (Geolocation).');
                return;
            }

            // Geolocation requires secure context on most browsers (HTTPS or localhost)
            const isLocalhost = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|::1)$/i.test(location.hostname);
            const isSecure = (typeof window !== 'undefined' && (window.isSecureContext || location.protocol === 'https:')) || isLocalhost;
            if (!isSecure) {
                alert('Trình duyệt chặn định vị vì trang chưa chạy HTTPS. Hãy dùng https (hoặc localhost khi dev).');
                return;
            }

            // Check permission if available (optional)
            try {
                const perm = await (navigator as any)?.permissions?.query?.({ name: 'geolocation' as PermissionName });
                if (perm && perm.state === 'denied') {
                    alert('Bạn đã chặn quyền truy cập vị trí cho trang này. Hãy mở cài đặt quyền vị trí của trình duyệt và cho phép lại.');
                    return;
                }
            } catch { /* ignore if Permissions API not available */ }

            const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 12000,
                    maximumAge: 1000,
                });
            });

            const pos = await getPosition();
            const { latitude, longitude } = pos.coords;
            set3DPinAt(longitude, latitude, '#22c55e');
        } catch (err: any) {
            // Map standard geolocation error codes to friendly messages
            const code = err?.code;
            const msg = err?.message;
            if (code === 1) {
                alert('Truy cập vị trí bị từ chối. Hãy cho phép trang truy cập vị trí trong cài đặt trình duyệt.');
            } else if (code === 2) {
                alert('Không xác định được vị trí. Hãy kiểm tra GPS hoặc thử lại sau.');
            } else if (code === 3) {
                alert('Lấy vị trí quá thời gian cho phép. Hãy thử lại khi tín hiệu tốt hơn.');
            } else {
                alert(`Không thể lấy vị trí: ${msg || 'Lỗi không xác định.'}`);
            }
        }
    }, [set3DPinAt]);

    const ensureVehicleMarker = useCallback((lng: number, lat: number) => {
        if (!mapRef.current) return;
        if (!vehicleMarkerRef.current) {
            const el = createVehicleElement();
            vehicleElRef.current = el;
            vehicleMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' as any })
                .setLngLat([lng, lat])
                .addTo(mapRef.current);
        } else {
            vehicleMarkerRef.current.setLngLat([lng, lat]);
        }
    }, [createVehicleElement]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
            if (e.key === 'q' || e.key === 'Q') {
                rotateBy(-10);
            } else if (e.key === 'e' || e.key === 'E') {
                rotateBy(10);
            } else if (e.key === 'r' || e.key === 'R') {
                resetNorth();
            } else if (e.key === 'Escape') {
                endPicking();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [rotateBy, resetNorth, endPicking]);

    const toggle3D = useCallback(() => {
        setIs3D((prev) => {
            const next = !prev;
            if (mapRef.current) {
                if (next) enable3D(mapRef.current);
                else disable3D(mapRef.current);
            }
            return next;
        });
    }, [enable3D, disable3D]);

    const toggleAngle = useCallback(() => {
        setAngled((prev) => {
            const next = !prev;
            if (mapRef.current) {
                if (next) {
                    mapRef.current.easeTo({ pitch: 55, bearing: -17.6, duration: 500 });
                } else {
                    mapRef.current.easeTo({ pitch: 0, bearing: 0, duration: 300 });
                }
            }
            return next;
        });
    }, []);

    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        const m = mapRef.current;

        if (!startMarkerRef.current && startPoint) {
            const startEl = create3DPinElement('#3b82f6', 1);
            startMarkerRef.current = new mapboxgl.Marker({ element: startEl, anchor: 'center' as any, draggable: true })
                .setLngLat(toLngLat(startPoint) as any)
                .addTo(m)
                .on('dragend', () => {
                    const ll = startMarkerRef.current!.getLngLat();
                    setStartPoint({ lat: ll.lat, lng: ll.lng });
                    updateStartLabelFrom(ll.lng, ll.lat);
                });
        } else if (startMarkerRef.current && startPoint) {
            startMarkerRef.current.setLngLat(toLngLat(startPoint) as any);
        }
        if (!endMarkerRef.current && endPoint) {
            const endEl = create3DPinElement('#ef4444', waypoints.length + 2);
            endMarkerRef.current = new mapboxgl.Marker({ element: endEl, anchor: 'center' as any, draggable: true })
                .setLngLat(toLngLat(endPoint) as any)
                .addTo(m)
                .on('dragend', () => {
                    const ll = endMarkerRef.current!.getLngLat();
                    setEndPoint({ lat: ll.lat, lng: ll.lng });
                    updateEndLabelFrom(ll.lng, ll.lat);
                });
        } else if (endMarkerRef.current && endPoint) {
            endMarkerRef.current.setLngLat(toLngLat(endPoint) as any);
        }
    }, [mapReady, startPoint, endPoint, updateStartLabelFrom, updateEndLabelFrom]);

    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        viaMarkersRef.current.forEach((mk) => mk.remove());
        viaMarkersRef.current = [];
        waypoints.forEach((wp, index) => {
            const wpEl = create3DPinElement('#1e40af', index + 2);
            const mk = new mapboxgl.Marker({ element: wpEl, anchor: 'center' as any }).setLngLat([wp.lng, wp.lat]).addTo(mapRef.current!);
            viaMarkersRef.current.push(mk);
        });

        // Update end marker number when waypoints change
        if (endMarkerRef.current && endPoint) {
            endMarkerRef.current.remove();
            const endEl = create3DPinElement('#ef4444', waypoints.length + 2);
            endMarkerRef.current = new mapboxgl.Marker({ element: endEl, anchor: 'center' as any, draggable: true })
                .setLngLat(toLngLat(endPoint) as any)
                .addTo(mapRef.current!)
                .on('dragend', () => {
                    const ll = endMarkerRef.current!.getLngLat();
                    setEndPoint({ lat: ll.lat, lng: ll.lng });
                    updateEndLabelFrom(ll.lng, ll.lat);
                });
        }
    }, [mapReady, waypoints, endPoint, create3DPinElement, updateEndLabelFrom]);

    const calculateRoute = useCallback(async () => {
        if (!startPoint || !endPoint || !mapRef.current) return;
        setIsRouting(true);
        setInstructions([]);
        setRouteSummary(null);
        const token = config.mapbox?.accessToken || (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string);
        const allPoints = [startPoint, ...waypoints, endPoint];
        const coordsParam = allPoints.map((p) => `${p.lng},${p.lat}`).join(';');
        const profileMapbox = profile === 'walking' ? 'walking' : profile === 'cycling' ? 'cycling' : 'driving';
        const url = `https://api.mapbox.com/directions/v5/mapbox/${profileMapbox}/${coordsParam}?alternatives=false&geometries=geojson&overview=full&steps=true&annotations=maxspeed&language=en&access_token=${encodeURIComponent(token || '')}`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data?.routes?.length) {
                const route = data.routes[0];
                const feature: Feature<LineString> = { type: 'Feature', geometry: route.geometry as LineString, properties: {} };
                const fc: FeatureCollection<Geometry> = { type: 'FeatureCollection', features: [feature] };
                routeDataRef.current = fc;
                (mapRef.current!.getSource(routeSourceId) as mapboxgl.GeoJSONSource).setData(fc);
                const legs: any[] = Array.isArray(route.legs) ? route.legs : [];
                const steps = legs.flatMap((leg: any) => {
                    const legSteps: any[] = Array.isArray(leg?.steps) ? leg.steps : [];
                    const maxSpeedAnn: any[] | undefined = leg?.annotation?.maxspeed;
                    let annotationIndex = 0;
                    const getSpeedValue = (entry: any): number | null => {
                        if (!entry || typeof entry !== 'object') return null;
                        const candidates = [entry.speed, entry.speed_limit, entry.maxspeed, entry.value];
                        for (const cand of candidates) {
                            if (typeof cand === 'number' && Number.isFinite(cand)) return cand;
                        }
                        return null;
                    };
                    const normalizeUnit = (entry: any): string | undefined => {
                        if (!entry || typeof entry !== 'object') return undefined;
                        const unit = entry.unit || entry.speed_unit || entry.maxspeed_unit;
                        return typeof unit === 'string' && unit.trim().length > 0 ? unit : undefined;
                    };
                    return legSteps.map((step: any) => {
                        const coordsForStep = step?.geometry?.coordinates;
                        const segmentCount = Array.isArray(coordsForStep) ? Math.max(0, coordsForStep.length - 1) : 0;
                        if (Array.isArray(maxSpeedAnn) && segmentCount > 0) {
                            const slice = maxSpeedAnn.slice(annotationIndex, annotationIndex + segmentCount);
                            annotationIndex += segmentCount;
                            if (slice.length > 0) {
                                const known = slice.find((entry) => entry && !entry.unknown && getSpeedValue(entry) != null);
                                const fallback = slice.find((entry) => entry && entry.unknown);
                                const chosen = known || fallback || null;
                                if (chosen) {
                                    const speedValue = getSpeedValue(chosen);
                                    const speedUnit = normalizeUnit(chosen);
                                    step.speedLimit = {
                                        value: speedValue != null ? speedValue : null,
                                        unit: speedUnit,
                                        unknown: !!chosen.unknown && (speedValue == null),
                                    };
                                }
                            }
                        } else if (Array.isArray(maxSpeedAnn) && segmentCount > 0) {
                            annotationIndex += segmentCount;
                        }
                        return step;
                    });
                });
                setInstructions(steps);
                setRouteSummary({ distanceKm: route.distance / 1000, durationMin: route.duration / 60 });
                const coords: [number, number][] = route.geometry.coordinates;
                const bounds = coords.reduce((b, c) => b.extend(c as any), new mapboxgl.LngLatBounds(coords[0] as any, coords[0] as any));
                if (keepZoom) {
                    const center = bounds.getCenter();
                    mapRef.current!.easeTo({ center: [center.lng, center.lat], duration: 300 });
                } else {
                    mapRef.current!.fitBounds(bounds, { padding: 40, maxZoom: 16 });
                }
                if (courseUpRef.current && coords.length >= 2) {
                    const [lon1, lat1] = coords[0];
                    const [lon2, lat2] = coords[1];
                    const br = computeBearing(lat1, lon1, lat2, lon2);
                    setHeadingDeg(br);
                    cameraBearingRef.current = br;
                    mapRef.current!.easeTo({ bearing: br, pitch: Math.max(mapRef.current!.getPitch(), 50), duration: 400 });
                }
                // Prepare simulation track
                simCoordsRef.current = coords;
                simCumDistRef.current = [0];
                for (let i = 1; i < coords.length; i++) {
                    const d = distanceMeters(coords[i - 1], coords[i]);
                    simCumDistRef.current.push(simCumDistRef.current[i - 1] + d);
                }
                simTotalDistRef.current = simCumDistRef.current[simCumDistRef.current.length - 1] ?? 0;
                simDistRef.current = 0;
                lastTsRef.current = null;
                // Build step cumulative ranges, first-coord indices, per-step meters & durations
                stepStartCumRef.current = [];
                stepEndCumRef.current = [];
                stepFirstCoordIndexRef.current = [];
                stepMetersRef.current = [];
                stepDurationSecRef.current = [];
                stepCumDurEndRef.current = [];
                routeTotalDurationSecRef.current = (route.duration as number) || 0;
                {
                    let globalIndex = 0; // index in coords array
                    for (let si = 0; si < steps.length; si++) {
                        const geom: [number, number][] = steps[si]?.geometry?.coordinates || [];
                        if (!geom || geom.length === 0) {
                            stepStartCumRef.current.push(simCumDistRef.current[globalIndex] || 0);
                            stepEndCumRef.current.push(simCumDistRef.current[globalIndex] || 0);
                            stepFirstCoordIndexRef.current.push(globalIndex);
                            stepMetersRef.current.push(0);
                            stepDurationSecRef.current.push((steps[si]?.duration as number) || 0);
                            stepCumDurEndRef.current.push((stepCumDurEndRef.current[stepCumDurEndRef.current.length - 1] || 0) + ((steps[si]?.duration as number) || 0));
                            continue;
                        }
                        const first = geom[0];
                        // find first occurrence index of this first coord in the full coords starting at current globalIndex
                        let found = globalIndex;
                        for (let gi = globalIndex; gi < coords.length; gi++) {
                            if (coords[gi][0] === first[0] && coords[gi][1] === first[1]) { found = gi; break; }
                        }
                        stepFirstCoordIndexRef.current.push(found);
                        const startCum = simCumDistRef.current[found] || 0;
                        // estimate end index: found + (geom.length - 1) but cap within coords
                        const endIdx = Math.min(coords.length - 1, found + Math.max(0, geom.length - 1));
                        const endCum = simCumDistRef.current[endIdx] || startCum;
                        stepStartCumRef.current.push(startCum);
                        stepEndCumRef.current.push(endCum);
                        stepMetersRef.current.push(Math.max(0, endCum - startCum));
                        const stepDur = (steps[si]?.duration as number) || 0;
                        stepDurationSecRef.current.push(stepDur);
                        const prevCumDur = stepCumDurEndRef.current[stepCumDurEndRef.current.length - 1] || 0;
                        stepCumDurEndRef.current.push(prevCumDur + stepDur);
                        globalIndex = endIdx; // advance hint
                    }
                }
                nextStepIdxRef.current = 0;
                setSimRemainingM(simTotalDistRef.current);
                setSimEtaSec(routeTotalDurationSecRef.current); // initialize ETA from API total duration
                // Distance to first maneuver is from position 0 to END of step 0 (next instruction)
                setSimToNextManeuverM(Math.max(0, (stepEndCumRef.current[0] || 0) - 0));
                const startPos = coords[0];
                const simEl = createVehicleElement('#f59e0b');
                if (simMarkerRef.current) simMarkerRef.current.remove();
                simMarkerRef.current = new mapboxgl.Marker({ element: simEl, anchor: 'center' as any })
                    .setLngLat(startPos as any)
                    .addTo(mapRef.current!);
            } else {
                alert('Không tìm thấy tuyến đường.');
            }
        } catch (e) {
            console.error('[Mapbox] Directions fetch error:', e);
            alert('Lỗi khi gọi Directions API.');
        } finally {
            setIsRouting(false);
        }
    }, [startPoint, endPoint, waypoints, profile, keepZoom, simSpeed]);

    useEffect(() => {
        if (!simPlaying) {
            if (simRAFRef.current != null) cancelAnimationFrame(simRAFRef.current);
            simRAFRef.current = null;
            lastTsRef.current = null;
            return;
        }
        if (!mapRef.current || !simMarkerRef.current || simTotalDistRef.current <= 0) return;
        const baseSpeed = 10; // m/s at 1x
        const step = (ts: number) => {
            if (!lastTsRef.current) lastTsRef.current = ts;
            const dtSec = Math.min(1, (ts - lastTsRef.current) / 1000);
            lastTsRef.current = ts;
            const advance = baseSpeed * simSpeed * dtSec;
            simDistRef.current = Math.min(simTotalDistRef.current, simDistRef.current + advance);
            const sample = positionAtDistance(simDistRef.current);
            if (sample) {
                const { pos, bearing } = sample;
                simMarkerRef.current!.setLngLat(pos as any);
                const el = simMarkerRef.current!.getElement() as HTMLDivElement;
                el.style.transform = `translateY(-4px) rotate(${bearing}deg)`;
                let camBearing = bearing;
                if (smoothTurns) {
                    const maxTurn = maxTurnRateDegPerSecRef.current * dtSec;
                    camBearing = stepBearingTowards(cameraBearingRef.current ?? bearing, bearing, maxTurn);
                    cameraBearingRef.current = camBearing;
                } else {
                    cameraBearingRef.current = bearing;
                }
                setHeadingDeg(camBearing);
                if (simFollow) {
                    const baseZoom = simLockedZoomRef.current != null ? simLockedZoomRef.current : mapRef.current!.getZoom();
                    const doubledZoom = Math.min(22, baseZoom);
                    const targetZoom = keepZoom ? doubledZoom : Math.max(doubledZoom, 18);
                    const targetPitch = Math.max(mapRef.current!.getPitch(), 60);
                    mapRef.current!.jumpTo({ center: pos as any, bearing: camBearing, zoom: targetZoom, pitch: targetPitch });
                }
                // Update metrics
                const remaining = Math.max(0, simTotalDistRef.current - simDistRef.current);
                setSimRemainingM(remaining);
                // Prefer ETA projected from routing API duration for consistency with route summary
                if (routeTotalDurationSecRef.current > 0) {
                    const fracRemaining = simTotalDistRef.current > 0 ? (remaining / simTotalDistRef.current) : 0;
                    setSimEtaSec(fracRemaining * routeTotalDurationSecRef.current);
                } else {
                    const v = baseSpeed * Math.max(0.1, simSpeed);
                    setSimEtaSec(remaining / v);
                }
                // Determine current and next step by cumulative arrays
                const starts = stepStartCumRef.current;
                const ends = stepEndCumRef.current;
                const nSteps = starts.length;
                if (nSteps > 0) {
                    let idx = nextStepIdxRef.current;
                    // Advance index while we've passed the end of the step
                    while (idx < nSteps && simDistRef.current >= (ends[idx] - 1e-6)) idx++;
                    // Determine indices for passed and upcoming instructions
                    const currentIdx = Math.min(nSteps - 1, idx); // step we are currently in
                    const curPassedIdx = currentIdx; // the maneuver at the start of the current step has just been passed
                    const nextIdx = Math.min(nSteps - 1, idx + 1); // upcoming step (next maneuver)
                    nextStepIdxRef.current = idx;
                    // Distance to next maneuver: distance from current position to END of current step
                    const toNextEnd = ends[currentIdx] ?? simTotalDistRef.current;
                    const toNext = Math.max(0, toNextEnd - simDistRef.current);
                    setSimToNextManeuverM(toNext);
                    if (mapRef.current) {
                        try {
                            // Build or update 'next' popup at next maneuver location
                            const nextStep = instructions[nextIdx];
                            const nextLoc = nextStep?.maneuver?.location as [number, number] | undefined;
                            if (nextLoc && (!nextPopupRef.current)) {
                                const html = renderInstructionPopupHTML(nextStep);
                                nextPopupRef.current = new mapboxgl.Popup({ closeOnClick: false, closeButton: false, offset: 14, className: 'instruction-popup' })
                                    .setLngLat(nextLoc as any)
                                    .setHTML(html)
                                    .addTo(mapRef.current);
                            } else if (nextLoc && nextPopupRef.current) {
                                const html = renderInstructionPopupHTML(nextStep);
                                nextPopupRef.current.setLngLat(nextLoc as any).setHTML(html);
                            }
                            // Build/update 'passed' popup at current/past step location
                            const passedStep = instructions[curPassedIdx];
                            const passedLoc = passedStep?.maneuver?.location as [number, number] | undefined;
                            if (passedLoc && (!lastPassedPopupRef.current)) {
                                const html = renderInstructionPopupHTML(passedStep);
                                lastPassedPopupRef.current = new mapboxgl.Popup({ closeOnClick: false, closeButton: false, offset: 14, className: 'instruction-popup' })
                                    .setLngLat(passedLoc as any)
                                    .setHTML(html)
                                    .addTo(mapRef.current);
                            } else if (passedLoc && lastPassedPopupRef.current) {
                                const html = renderInstructionPopupHTML(passedStep);
                                lastPassedPopupRef.current.setLngLat(passedLoc as any).setHTML(html);
                            }
                        } catch { }
                    }
                }
            }
            if (simDistRef.current >= simTotalDistRef.current) {
                setSimPlaying(false);
                // Cleanup popups at end
                if (lastPassedPopupRef.current) { lastPassedPopupRef.current.remove(); lastPassedPopupRef.current = null; }
                if (nextPopupRef.current) { nextPopupRef.current.remove(); nextPopupRef.current = null; }
                simRAFRef.current = null;
                return;
            }
            simRAFRef.current = requestAnimationFrame(step);
        };
        simRAFRef.current = requestAnimationFrame(step);
        return () => {
            if (simRAFRef.current != null) cancelAnimationFrame(simRAFRef.current);
            simRAFRef.current = null;
            if (lastPassedPopupRef.current) { lastPassedPopupRef.current.remove(); lastPassedPopupRef.current = null; }
            if (nextPopupRef.current) { nextPopupRef.current.remove(); nextPopupRef.current = null; }
        };
    }, [simPlaying, simSpeed, simFollow, positionAtDistance, keepZoom, instructions]);

    useEffect(() => {
        if (simPlaying && simFollow && mapRef.current) {
            if (simLockedZoomRef.current == null) {
                const currentZoom = mapRef.current.getZoom();
                simLockedZoomRef.current = keepZoom ? currentZoom : Math.max(currentZoom, 17);
            }
        } else {
            simLockedZoomRef.current = null;
        }
    }, [keepZoom, simPlaying, simFollow]);

    const focusStep = useCallback((index: number) => {
        if (!mapRef.current || !instructions[index]) return;
        setActiveStepIdx(index);
        const step = instructions[index];
        const data: FeatureCollection<Geometry> = { type: 'FeatureCollection', features: step?.geometry ? [{ type: 'Feature', geometry: step.geometry as Geometry, properties: {} } as Feature<Geometry>] : [] };
        stepDataRef.current = data;
        const src = mapRef.current.getSource(stepSourceId) as mapboxgl.GeoJSONSource;
        src && src.setData(data);
        try {
            const coords = step.geometry.coordinates as [number, number][];
            if (coords && coords.length >= 2) {
                const [lon1, lat1] = coords[0];
                const [lon2, lat2] = coords[1];
                const bearing = computeBearing(lat1, lon1, lat2, lon2);
                cameraBearingRef.current = bearing;
                setHeadingDeg(bearing);
                const bounds = coords.reduce((b, c) => b.extend(c as any), new mapboxgl.LngLatBounds(coords[0] as any, coords[0] as any));
                const center = bounds.getCenter();
                mapRef.current.easeTo({ center: [center.lng, center.lat], bearing, pitch: 60, duration: 600 });
                if (!keepZoom) mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 18 });

                if (!showAllPopups) {
                    try {
                        const loc = step?.maneuver?.location as [number, number] | undefined;
                        if (loc && Array.isArray(loc) && loc.length >= 2) {
                            if (openStepPopupRef.current) {
                                openStepPopupRef.current.remove();
                                openStepPopupRef.current = null;
                            }
                            const html = renderInstructionPopupHTML(step);
                            openStepPopupRef.current = new mapboxgl.Popup({ closeOnClick: false, offset: 10 })
                                .setLngLat(loc as any)
                                .setHTML(html)
                                .addTo(mapRef.current!);
                        }
                    } catch { }
                }
            }
        } catch { }
    }, [instructions, keepZoom]);

    useEffect(() => {
        if (!guidanceMode) return;
        if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
        if (geoWatchIdRef.current != null) return;
        const id = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude, heading } = pos.coords as any;
                const cp = { lat: latitude, lng: longitude };
                ensureVehicleMarker(cp.lng, cp.lat);
                let targetBearing: number | null = null;
                if (typeof heading === 'number' && !Number.isNaN(heading)) {
                    targetBearing = heading;
                } else if (activeStepIdx != null && instructions[activeStepIdx]?.geometry?.coordinates?.length >= 2) {
                    const [lon1, lat1] = instructions[activeStepIdx].geometry.coordinates[0];
                    const [lon2, lat2] = instructions[activeStepIdx].geometry.coordinates[1];
                    targetBearing = computeBearing(lat1, lon1, lat2, lon2);
                }
                if (targetBearing != null) {
                    const now = performance.now();
                    const prevTs = lastGuidanceTsRef.current ?? now;
                    const dtSec = Math.min(1, (now - prevTs) / 1000);
                    lastGuidanceTsRef.current = now;
                    let camBearing = targetBearing;
                    if (smoothTurns) {
                        const maxTurn = maxTurnRateDegPerSecRef.current * dtSec;
                        camBearing = stepBearingTowards(cameraBearingRef.current ?? targetBearing, targetBearing, maxTurn);
                        cameraBearingRef.current = camBearing;
                    } else {
                        cameraBearingRef.current = targetBearing;
                    }
                    setHeadingDeg(camBearing);
                    mapRef.current?.easeTo({ center: [cp.lng, cp.lat], bearing: camBearing, duration: 250 });
                } else {
                    mapRef.current?.easeTo({ center: [cp.lng, cp.lat], duration: 250 });
                }
            },
            (err) => { console.warn('[Mapbox] Geolocation error:', err); },
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
        );
        geoWatchIdRef.current = (id as unknown as number) ?? null;
        return () => {
            if (geoWatchIdRef.current != null) {
                navigator.geolocation.clearWatch(geoWatchIdRef.current);
                geoWatchIdRef.current = null;
            }
        };
    }, [guidanceMode, activeStepIdx, instructions]);

    useEffect(() => {
        if (!vehicleElRef.current) return;
        vehicleElRef.current.style.transform = `translateY(-4px) rotate(${headingDeg}deg)`;
    }, [headingDeg]);

    useEffect(() => {
        // Always rebuild markers; popups depend on simPlaying/showAllPopups
        stepMarkersRef.current.forEach((m) => m.remove());
        stepMarkersRef.current = [];
        // Remove any adhoc open step popup when rebuilding
        if (openStepPopupRef.current) {
            openStepPopupRef.current.remove();
            openStepPopupRef.current = null;
        }
        // When simulation is running, also remove any static step popups and skip creating them
        if (simPlaying) {
            stepPopupsRef.current.forEach((p) => p.remove());
            stepPopupsRef.current = [];
        }
        if (!mapReady || !mapRef.current) return;
        if (!instructions || instructions.length === 0) return;

        const makeStepEl = (modifier?: string, step?: any) => {
            const wrap = document.createElement('div');
            wrap.style.width = '28px';
            wrap.style.height = '28px';
            wrap.style.borderRadius = '9999px';
            wrap.style.background = '#ffffff';
            wrap.style.border = '2px solid #2563eb';
            wrap.style.boxShadow = '0 3px 6px rgba(0,0,0,0.25)';
            wrap.style.display = 'flex';
            wrap.style.alignItems = 'center';
            wrap.style.justifyContent = 'center';
            wrap.style.cursor = 'pointer';
            try {
                const { src } = pickManeuverIcon(step || { maneuver: { modifier } });
                const rotate = computeManeuverRotation(step || { maneuver: { modifier } });
                if (src) {
                    const img = document.createElement('img');
                    img.src = src;
                    img.width = 16;
                    img.height = 16;
                    img.style.display = 'block';
                    wrap.appendChild(img);
                    return wrap;
                }
            } catch { }
            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '16');
            svg.style.transform = `rotate(${computeManeuverRotation(step || { maneuver: { modifier } })}deg)`;
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', 'M12 2 L15 10 L12 8 L9 10 Z');
            path.setAttribute('fill', '#2563eb');
            svg.appendChild(path);
            wrap.appendChild(svg);
            return wrap;
        };

        instructions.forEach((step: any, idx: number) => {
            const loc = step?.maneuver?.location as [number, number] | undefined;
            if (!loc || !Array.isArray(loc) || loc.length < 2) return;
            const el = makeStepEl(step?.maneuver?.modifier, step);
            const mk = new mapboxgl.Marker({ element: el, anchor: 'center' as any })
                .setLngLat(loc as any)
                .addTo(mapRef.current!);
            if (showAllPopups && !simPlaying) {
                try {
                    const html = renderInstructionPopupHTML(step);
                    const pp = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'instruction-popup' })
                        .setLngLat(loc as any)
                        .setHTML(html)
                        .addTo(mapRef.current!);
                    stepPopupsRef.current.push(pp);
                } catch { }
            }
            el.addEventListener('click', () => {
                try {
                    const coords = step?.geometry?.coordinates as [number, number][] | undefined;
                    if (coords && coords.length >= 2) {
                        const [lon1, lat1] = coords[0];
                        const [lon2, lat2] = coords[1];
                        const br = computeBearing(lat1, lon1, lat2, lon2);
                        setActiveStepIdx(idx);
                        stepDataRef.current = { type: 'FeatureCollection', features: step?.geometry ? [{ type: 'Feature', geometry: step.geometry as Geometry, properties: {} } as Feature<Geometry>] : [] };
                        const src = mapRef.current!.getSource(stepSourceId) as mapboxgl.GeoJSONSource;
                        src && src.setData(stepDataRef.current);
                        cameraBearingRef.current = br;
                        const cam: any = { center: loc as any, bearing: br, pitch: Math.max(mapRef.current!.getPitch(), 60), duration: 500 };
                        if (!keepZoom) cam.zoom = Math.max(mapRef.current!.getZoom(), 17.5);
                        mapRef.current!.easeTo(cam);
                        setHeadingDeg(br);

                        if (!showAllPopups && !simPlaying) {
                            try {
                                if (openStepPopupRef.current) {
                                    openStepPopupRef.current.remove();
                                    openStepPopupRef.current = null;
                                }
                                const html = renderInstructionPopupHTML(step);
                                openStepPopupRef.current = new mapboxgl.Popup({ closeOnClick: false, closeButton: false, offset: 14, className: 'instruction-popup' })
                                    .setLngLat(loc as any)
                                    .setHTML(html)
                                    .addTo(mapRef.current!);
                            } catch { }
                        }
                    }
                } catch { }
            });
            stepMarkersRef.current.push(mk);
        });

        return () => {
            stepMarkersRef.current.forEach((m) => m.remove());
            stepMarkersRef.current = [];
            if (openStepPopupRef.current) {
                openStepPopupRef.current.remove();
                openStepPopupRef.current = null;
            }
            stepPopupsRef.current.forEach((p) => p.remove());
            stepPopupsRef.current = [];
        };
    }, [instructions, mapReady, showAllPopups, simPlaying]);

    useEffect(() => {
        if (simPlaying) {
            // Suppress adhoc popup while simulating
            if (openStepPopupRef.current) {
                openStepPopupRef.current.remove();
                openStepPopupRef.current = null;
            }
            return;
        }
        if (showAllPopups) return;
        if (!mapReady || !mapRef.current) return;
        if (!instructions || instructions.length === 0) return;
        const idx = activeStepIdx != null ? activeStepIdx : 0;
        const step = instructions[idx];
        if (!step) return;
        const loc = step?.maneuver?.location as [number, number] | undefined;
        if (!loc || !Array.isArray(loc) || loc.length < 2) return;
        const html = renderInstructionPopupHTML(step);
        try {
            if (openStepPopupRef.current) {
                const cur = openStepPopupRef.current.getLngLat();
                if (cur && cur.lng === loc[0] && cur.lat === loc[1]) {
                    openStepPopupRef.current.setHTML(html);
                    return;
                }
                openStepPopupRef.current.remove();
                openStepPopupRef.current = null;
            }
            openStepPopupRef.current = new mapboxgl.Popup({ closeOnClick: false, closeButton: false, offset: 14, className: 'instruction-popup' })
                .setLngLat(loc as any)
                .setHTML(html)
                .addTo(mapRef.current!);
        } catch { }
    }, [activeStepIdx, instructions, mapReady, showAllPopups, simPlaying]);

    useEffect(() => {
        if (!guidanceMode || activeStepIdx == null || !instructions[activeStepIdx]) return;
        const step = instructions[activeStepIdx];
        const coords: [number, number][] | undefined = step?.geometry?.coordinates;
        if (!coords || coords.length === 0) return;
        const toMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
            const R = 6371000;
            const dLat = ((b.lat - a.lat) * Math.PI) / 180;
            const dLon = ((b.lng - a.lng) * Math.PI) / 180;
            const lat1 = (a.lat * Math.PI) / 180;
            const lat2 = (b.lat * Math.PI) / 180;
            const s1 = Math.sin(dLat / 2);
            const s2 = Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2), Math.sqrt(1 - (s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2)));
            return R * c;
        };
        const [endLon, endLat] = coords[coords.length - 1];
        const center = mapRef.current?.getCenter();
        if (!center) return;
        const distToEnd = toMeters({ lat: center.lat, lng: center.lng }, { lat: endLat, lng: endLon });
        if (distToEnd <= autoAdvanceThresholdM) {
            const nextIdx = Math.min(instructions.length - 1, activeStepIdx + 1);
            if (nextIdx !== activeStepIdx) focusStep(nextIdx);
        }
    }, [guidanceMode, activeStepIdx, instructions, focusStep]);

    useEffect(() => {
        if (!courseUp || guidanceMode) return;
        if (!mapRef.current) return;
        let coords: [number, number][] | undefined;
        const idx = activeStepIdx ?? 0;
        const step = instructions[idx];
        if (step?.geometry?.coordinates) {
            coords = step.geometry.coordinates as [number, number][];
        } else {
            const routeGeom = routeDataRef.current?.features?.[0]?.geometry as any;
            if (routeGeom?.coordinates) coords = routeGeom.coordinates as [number, number][];
        }
        if (!coords || coords.length < 2) return;
        const [lon1, lat1] = coords[0];
        const [lon2, lat2] = coords[1];
        const br = computeBearing(lat1, lon1, lat2, lon2);
        setHeadingDeg(br);
        mapRef.current.easeTo({ bearing: br, pitch: Math.max(mapRef.current.getPitch(), 50), duration: 300 });
    }, [courseUp, guidanceMode, activeStepIdx, instructions]);

    return (
        <div className="w-full h-screen flex flex-col">
            <style>{`
                .mapboxgl-popup.instruction-popup { pointer-events: none; }
                .mapboxgl-popup.instruction-popup .mapboxgl-popup-content {
                    background: rgba(255,255,255,0.85);
                    backdrop-filter: blur(2px);
                    padding: 6px 8px;
                    border-radius: 8px;
                    box-shadow: 0 6px 16px rgba(0,0,0,0.18);
                    pointer-events: auto;
                }
                .mapboxgl-popup.instruction-popup .mapboxgl-popup-tip { display: none; }
            `}</style>
            <Toolbar
                is3D={is3D}
                angled={angled}
                keepZoom={keepZoom}
                showAllPopups={showAllPopups}
                onToggle3D={toggle3D}
                onToggleAngle={toggleAngle}
                onToggleKeepZoom={() => setKeepZoom(v => !v)}
                onToggleShowAllPopups={() => setShowAllPopups(v => !v)}
                onRotateLeft={() => rotateBy(-10)}
                onRotateRight={() => rotateBy(10)}
                onResetNorth={resetNorth}
                onPinMyLocation={handlePinMyLocation}
            />
            {error ? (
                <div className="p-4 text-red-600 text-sm">{error}</div>
            ) : null}
            <div ref={mapContainer} style={{ height: "100%", width: "100%" }} />
            <ControlsPanel
                profile={profile}
                setProfile={(p) => setProfile(p)}
                isRouting={isRouting}
                calculateRoute={calculateRoute}
                instructions={instructions}
                routeSummary={routeSummary}
                activeStepIdx={activeStepIdx}
                focusStep={focusStep}
                onStartGuidance={() => { if (!instructions || instructions.length === 0) return; setGuidanceMode(true); focusStep(0); }}
                startPoint={startPoint}
                endPoint={endPoint}
                waypoints={waypoints}
                startLabel={startLabel}
                endLabel={endLabel}
                waypointLabels={waypointLabels}
                setWaypointLabels={setWaypointLabels}
                setStartPoint={setStartPoint}
                setEndPoint={setEndPoint}
                setWaypoints={setWaypoints}
                onPickStart={() => beginPicking({ type: 'start' })}
                onPickEnd={() => beginPicking({ type: 'end' })}
                onPickWaypoint={(index: number) => beginPicking({ type: 'via', index })}
                focusOnCoordinate={focusOnCoordinate}
            />
            <SimulationPanel
                simPlaying={simPlaying}
                setSimPlaying={setSimPlaying}
                simSpeed={simSpeed}
                setSimSpeed={setSimSpeed}
                simFollow={simFollow}
                setSimFollow={setSimFollow}
                canSimulate={!!routeDataRef.current && simTotalDistRef.current > 0}
                onSimReset={() => {
                    simDistRef.current = 0;
                    lastTsRef.current = null;
                    nextStepIdxRef.current = 0;
                    setSimRemainingM(simTotalDistRef.current);
                    if (routeTotalDurationSecRef.current > 0) setSimEtaSec(routeTotalDurationSecRef.current);
                    else setSimEtaSec((simTotalDistRef.current / (10 * Math.max(0.1, simSpeed))) || 0);
                    setSimToNextManeuverM(Math.max(0, (stepEndCumRef.current[0] || 0) - 0));
                    const sample = positionAtDistance(0);
                    if (sample && simMarkerRef.current) {
                        simMarkerRef.current.setLngLat(sample.pos as any);
                        const el = simMarkerRef.current.getElement() as HTMLDivElement;
                        el.style.transform = `translateY(-4px) rotate(${sample.bearing}deg)`;
                        cameraBearingRef.current = sample.bearing;
                        if (simFollow && mapRef.current) {
                            const baseZoom = simLockedZoomRef.current != null ? simLockedZoomRef.current : mapRef.current.getZoom();
                            const doubledZoom = Math.min(22, baseZoom + 1);
                            const targetZoom = keepZoom ? doubledZoom : Math.max(doubledZoom, 18);
                            const targetPitch = Math.max(mapRef.current.getPitch(), 60);
                            mapRef.current.jumpTo({ center: sample.pos as any, bearing: cameraBearingRef.current, zoom: targetZoom, pitch: targetPitch });
                        }
                    }
                }}
                simRemainingM={simRemainingM}
                simEtaSec={simEtaSec}
                simToNextManeuverM={simToNextManeuverM}
            />
            <GuidanceHUD
                visible={guidanceMode}
                headingDeg={headingDeg}
                instructions={instructions}
                activeStepIdx={activeStepIdx}
                onPrev={() => focusStep(Math.max(0, (activeStepIdx || 0) - 1))}
                onNext={() => focusStep(Math.min(instructions.length - 1, (activeStepIdx || 0) + 1))}
                onStop={() => { setGuidanceMode(false); setActiveStepIdx(null); (mapRef.current?.getSource(stepSourceId) as mapboxgl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] } as any); }}
            />
        </div>
    );
}
