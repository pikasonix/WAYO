"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import type { Feature, FeatureCollection, LineString, Geometry } from 'geojson';
import "mapbox-gl/dist/mapbox-gl.css";
import config from "@/config/config";
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
    const [courseUp, setCourseUp] = useState(true);
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
    const [smoothTurns, setSmoothTurns] = useState<boolean>(true);
    const maxTurnRateDegPerSecRef = useRef<number>(60);
    const [alwaysShowPopup, setAlwaysShowPopup] = useState<boolean>(true);
    const [showAllPopups, setShowAllPopups] = useState<boolean>(true);
    // Simulation UI state
    const [simPlaying, setSimPlaying] = useState<boolean>(false);
    const [simSpeed, setSimSpeed] = useState<number>(1);
    const [simFollow, setSimFollow] = useState<boolean>(true);
    const geoWatchIdRef = useRef<number | null>(null);
    const courseUpRef = useRef<boolean>(false);
    const cameraBearingRef = useRef<number>(0);
    const lastGuidanceTsRef = useRef<number | null>(null);
    const autoAdvanceThresholdM = 25;

    // keep ref in sync with state
    useEffect(() => {
        courseUpRef.current = courseUp;
    }, [courseUp]);

    const toLngLat = (p: { lat: number; lng: number }) => [p.lng, p.lat] as [number, number];
    // moved helpers to ./formatters, ./geo, ./maneuvers

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
                    mapRef.current.addLayer({ id: 'route-line-layer', type: 'line', source: routeSourceId, paint: { 'line-color': '#3388ff', 'line-width': 5, 'line-opacity': 0.7 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
                }
                if (!mapRef.current.getSource(stepSourceId)) {
                    mapRef.current.addSource(stepSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                    mapRef.current.addLayer({ id: 'step-line-layer', type: 'line', source: stepSourceId, paint: { 'line-color': '#ef4444', 'line-width': 6, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
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

    // Use external helper to create pin elements
    const create3DPinElement = useCallback((color: string = '#ef4444') => createPinElement(color), []);

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
            if (e.repeat) return;
            if (e.key === 'q' || e.key === 'Q') {
                rotateBy(-10);
            } else if (e.key === 'e' || e.key === 'E') {
                rotateBy(10);
            } else if (e.key === 'r' || e.key === 'R') {
                resetNorth();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [rotateBy, resetNorth]);

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
        const createMarkerEl = (color: string) => {
            const el = create3DPinElement(color);
            return new mapboxgl.Marker({ element: el, anchor: 'center' as any, draggable: true });
        };

        if (!startMarkerRef.current && startPoint) {
            startMarkerRef.current = createMarkerEl('#3b82f6')
                .setLngLat(toLngLat(startPoint) as any)
                .addTo(m)
                .on('dragend', () => {
                    const ll = startMarkerRef.current!.getLngLat();
                    setStartPoint({ lat: ll.lat, lng: ll.lng });
                });
        } else if (startMarkerRef.current && startPoint) {
            startMarkerRef.current.setLngLat(toLngLat(startPoint) as any);
        }
        if (!endMarkerRef.current && endPoint) {
            endMarkerRef.current = createMarkerEl('#ef4444')
                .setLngLat(toLngLat(endPoint) as any)
                .addTo(m)
                .on('dragend', () => {
                    const ll = endMarkerRef.current!.getLngLat();
                    setEndPoint({ lat: ll.lat, lng: ll.lng });
                });
        } else if (endMarkerRef.current && endPoint) {
            endMarkerRef.current.setLngLat(toLngLat(endPoint) as any);
        }
    }, [mapReady, startPoint, endPoint]);

    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        viaMarkersRef.current.forEach((mk) => mk.remove());
        viaMarkersRef.current = [];
        waypoints.forEach((wp) => {
            const mk = new mapboxgl.Marker({ color: '#1e40af' }).setLngLat([wp.lng, wp.lat]).addTo(mapRef.current!);
            viaMarkersRef.current.push(mk);
        });
    }, [mapReady, waypoints]);

    const calculateRoute = useCallback(async () => {
        if (!startPoint || !endPoint || !mapRef.current) return;
        setIsRouting(true);
        setInstructions([]);
        setRouteSummary(null);
        const token = config.mapbox?.accessToken || (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string);
        const allPoints = [startPoint, ...waypoints, endPoint];
        const coordsParam = allPoints.map((p) => `${p.lng},${p.lat}`).join(';');
        const profileMapbox = profile === 'walking' ? 'walking' : profile === 'cycling' ? 'cycling' : 'driving';
        const url = `https://api.mapbox.com/directions/v5/mapbox/${profileMapbox}/${coordsParam}?alternatives=false&geometries=geojson&overview=full&steps=true&language=en&access_token=${encodeURIComponent(token || '')}`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data?.routes?.length) {
                const route = data.routes[0];
                const feature: Feature<LineString> = { type: 'Feature', geometry: route.geometry as LineString, properties: {} };
                const fc: FeatureCollection<Geometry> = { type: 'FeatureCollection', features: [feature] };
                routeDataRef.current = fc;
                (mapRef.current!.getSource(routeSourceId) as mapboxgl.GeoJSONSource).setData(fc);
                const steps = route.legs.flatMap((leg: any) => leg.steps || []);
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
    }, [startPoint, endPoint, waypoints, profile, keepZoom]);

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
            }
            if (simDistRef.current >= simTotalDistRef.current) {
                setSimPlaying(false);
                simRAFRef.current = null;
                return;
            }
            simRAFRef.current = requestAnimationFrame(step);
        };
        simRAFRef.current = requestAnimationFrame(step);
        return () => {
            if (simRAFRef.current != null) cancelAnimationFrame(simRAFRef.current);
            simRAFRef.current = null;
        };
    }, [simPlaying, simSpeed, simFollow, positionAtDistance, keepZoom]);

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
        stepMarkersRef.current.forEach((m) => m.remove());
        stepMarkersRef.current = [];
        if (openStepPopupRef.current) {
            openStepPopupRef.current.remove();
            openStepPopupRef.current = null;
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
            if (showAllPopups) {
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

                        if (!showAllPopups) {
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
    }, [instructions, mapReady, showAllPopups]);

    useEffect(() => {
        if (!alwaysShowPopup) return;
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
    }, [alwaysShowPopup, activeStepIdx, instructions, mapReady, showAllPopups]);

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
                courseUp={courseUp}
                keepZoom={keepZoom}
                smoothTurns={smoothTurns}
                alwaysShowPopup={alwaysShowPopup}
                showAllPopups={showAllPopups}
                onToggle3D={toggle3D}
                onToggleAngle={toggleAngle}
                onToggleCourseUp={() => setCourseUp(v => !v)}
                onToggleKeepZoom={() => setKeepZoom(v => !v)}
                onToggleSmoothTurns={() => setSmoothTurns(v => !v)}
                onToggleAlwaysShowPopup={() => setAlwaysShowPopup(v => !v)}
                onToggleShowAllPopups={() => setShowAllPopups(v => !v)}
                onRotateLeft={() => rotateBy(-10)}
                onRotateRight={() => rotateBy(10)}
                onResetNorth={resetNorth}
                onPinMyLocation={() => {
                    if (!('geolocation' in navigator)) {
                        alert('Thiết bị không hỗ trợ định vị.');
                        return;
                    }
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            const { latitude, longitude } = pos.coords;
                            set3DPinAt(longitude, latitude, '#22c55e');
                        },
                        (err) => {
                            console.warn('Geolocation error', err);
                            alert('Không thể lấy vị trí hiện tại.');
                        },
                        { enableHighAccuracy: true, timeout: 8000, maximumAge: 1000 }
                    );
                }}
                onPinStep={() => {
                    let target: [number, number] | null = null;
                    const step = activeStepIdx != null ? instructions[activeStepIdx] : null;
                    const stepCoords: [number, number][] | undefined = step?.geometry?.coordinates;
                    if (stepCoords && stepCoords.length > 0) {
                        target = stepCoords[0] as [number, number];
                    } else {
                        const routeGeom: any = routeDataRef.current?.features?.[0]?.geometry;
                        const routeCoords: [number, number][] | undefined = routeGeom?.coordinates;
                        if (routeCoords && routeCoords.length > 0) {
                            target = routeCoords[0] as [number, number];
                        } else if (startPoint) {
                            target = [startPoint.lng, startPoint.lat];
                        }
                    }
                    if (target) {
                        set3DPinAt(target[0], target[1], '#3b82f6');
                    } else {
                        alert('Chưa có tuyến đường/bước để đặt pin.');
                    }
                }}
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
