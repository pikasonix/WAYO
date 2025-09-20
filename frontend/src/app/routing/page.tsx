"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';

const RoutingPage: React.FC = () => {
    // map refs and state
    const mapRef = useRef<HTMLDivElement | null>(null);
    const mapInstance = useRef<any | null>(null);
    const leafletRef = useRef<any | null>(null);
    const [mapReady, setMapReady] = useState(false);

    // routing state
    const [startPoint, setStartPoint] = useState<{ lat: number, lng: number } | null>({ lat: 21.0278, lng: 105.8342 });
    const [endPoint, setEndPoint] = useState<{ lat: number, lng: number } | null>({ lat: 21.0378, lng: 105.8442 });
    const [route, setRoute] = useState<any | null>(null);
    const [instructions, setInstructions] = useState<any[]>([]);
    const [isRouting, setIsRouting] = useState(false);

    const startMarkerRef = useRef<any | null>(null);
    const endMarkerRef = useRef<any | null>(null);
    const routeLayerRef = useRef<any | null>(null);

    // Load Leaflet
    useEffect(() => {
        if (typeof window === 'undefined') return;
        let mounted = true;
        (async () => {
            if (leafletRef.current) return;
            const L = await import('leaflet');
            leafletRef.current = L;
            if (!mounted) return;
            setMapReady(true);
        })();
        return () => { mounted = false; };
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapReady || !leafletRef.current) return;
        if (!mapRef.current || mapInstance.current) return;

        const L = leafletRef.current;
        mapInstance.current = L.map(mapRef.current).setView([21.0278, 105.8342], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstance.current);

        if (startPoint) {
            startMarkerRef.current = L.marker([startPoint.lat, startPoint.lng], { draggable: true }).addTo(mapInstance.current);
            startMarkerRef.current.on('dragend', (e: any) => {
                setStartPoint(e.target.getLatLng());
            });
        }

        if (endPoint) {
            endMarkerRef.current = L.marker([endPoint.lat, endPoint.lng], { draggable: true }).addTo(mapInstance.current);
            endMarkerRef.current.on('dragend', (e: any) => {
                setEndPoint(e.target.getLatLng());
            });
        }

        return () => {
            mapInstance.current?.remove();
            mapInstance.current = null;
        };
    }, [mapReady]);

    // Update marker positions
    useEffect(() => {
        if (startMarkerRef.current && startPoint) {
            startMarkerRef.current.setLatLng(startPoint);
        }
        if (endMarkerRef.current && endPoint) {
            endMarkerRef.current.setLatLng(endPoint);
        }
    }, [startPoint, endPoint]);

    const calculateRoute = useCallback(async () => {
        if (!startPoint || !endPoint) return;
        setIsRouting(true);
        setRoute(null);
        setInstructions([]);

        const coords = `${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}`;
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&steps=true&geometries=geojson`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.code === 'Ok' && data.routes.length > 0) {
                const route = data.routes[0];
                setRoute(route);
                setInstructions(route.legs[0].steps);

                if (mapInstance.current && leafletRef.current) {
                    const L = leafletRef.current;
                    if (routeLayerRef.current) {
                        mapInstance.current.removeLayer(routeLayerRef.current);
                    }
                    routeLayerRef.current = L.geoJSON(route.geometry, {
                        style: {
                            color: '#3388ff',
                            weight: 5,
                            opacity: 0.7
                        }
                    }).addTo(mapInstance.current);
                    mapInstance.current.fitBounds(routeLayerRef.current.getBounds());
                }
            } else {
                alert('Could not find a route.');
            }
        } catch (error) {
            console.error('Error fetching route:', error);
            alert('Error fetching route.');
        } finally {
            setIsRouting(false);
        }
    }, [startPoint, endPoint]);

    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            <div style={{ width: '300px', padding: '1rem', overflowY: 'auto', borderRight: '1px solid #ccc' }}>
                <h2>Routing</h2>
                <button onClick={calculateRoute} disabled={isRouting}>
                    {isRouting ? 'Calculating...' : 'Calculate Route'}
                </button>
                {startPoint && <p>Start: {startPoint.lat.toFixed(5)}, {startPoint.lng.toFixed(5)}</p>}
                {endPoint && <p>End: {endPoint.lat.toFixed(5)}, {endPoint.lng.toFixed(5)}</p>}
                <hr />
                <h3>Instructions</h3>
                <ol style={{ paddingLeft: '20px' }}>
                    {instructions.map((step, index) => (
                        <li key={index}>
                            {step.maneuver.instruction} ({Math.round(step.distance)}m)
                        </li>
                    ))}
                </ol>
            </div>
            <div ref={mapRef} style={{ flex: 1 }} />
        </div>
    );
};

export default RoutingPage;
