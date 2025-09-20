"use client";

import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftToLine, MapPinPlus, X, Grid2x2X, Grid2x2Plus, WandSparkles, MapPinXInside, LoaderCircle, FileCode, Download, Play } from 'lucide-react';

import type { NodeRow } from './NodeEditor';
import TimeMatrixControls from './TimeMatrixControls';
import NodeTableInput from './NodeTableInput';
import InstanceSettingsPanel from './InstanceSettingsPanel';
import NodeDetailsPanel from './NodeDetailsPanel';
import { useFileReader } from '@/hooks/useFileReader';
import type { Instance } from '@/utils/dataModels';
import { useRouter } from 'next/navigation';

export interface AddInstanceBuilderProps {
    onBack?: () => void;
    onInstanceLoad?: (fileOrInstance: File | { text: string }) => void;
}

const defaultCapacity = 100;

const AddInstanceBuilder: React.FC<AddInstanceBuilderProps> = ({ onBack, onInstanceLoad }) => {
    const router = useRouter();
    // metadata
    // Use a deterministic initial name to avoid SSR/client hydration mismatches.
    // Generate a timestamped name on the client after mount.
    const [instanceData, setInstanceData] = useState(() => ({
        name: 'instance',
        location: '',
        comment: '',
        routeTime: 480,
        timeWindow: 120,
        capacity: defaultCapacity
    }));

    // Set a timestamped name only on the client to avoid hydration mismatch
    useEffect(() => {
        // Only set if the name is still the default placeholder
        if (!instanceData.name || instanceData.name === 'instance') {
            const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
            setInstanceData(prev => ({ ...prev, name: `instance-${ts}` }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // node management
    const [nodes, setNodes] = useState<NodeRow[]>([]);
    const [isAddingNode, setIsAddingNode] = useState<boolean>(false);
    const isAddingNodeRef = useRef(false);
    const [editingNode, setEditingNode] = useState<NodeRow | null>(null);
    const [nextNodeId, setNextNodeId] = useState<number>(1);

    // time matrix state
    const [timeMatrix, setTimeMatrix] = useState<number[][]>([]);
    const [isGeneratingMatrix, setIsGeneratingMatrix] = useState(false);
    const [matrixGenerationProgress, setMatrixGenerationProgress] = useState(0);
    // File loading state
    const { readInstanceFile } = useFileReader();
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    // (moved) file load handlers are defined after showNotification

    // UI state
    const [notification, setNotification] = useState<null | { type: 'success' | 'error' | 'info', message: string }>(null);
    const [showTableInput, setShowTableInput] = useState(false);
    const [tableData, setTableData] = useState<any[]>([]);
    const [tableDirty, setTableDirty] = useState(false);
    const [isSelectingLocation, setIsSelectingLocation] = useState(false);
    const isSelectingLocationRef = useRef(false);
    const [selectedTableRowIndex, setSelectedTableRowIndex] = useState<number | null>(null);
    const selectedRowIndexRef = useRef<number | null>(null);
    const routeTimeRef = useRef<number>(480);

    useEffect(() => { isAddingNodeRef.current = isAddingNode; }, [isAddingNode]);
    useEffect(() => { selectedRowIndexRef.current = selectedTableRowIndex; }, [selectedTableRowIndex]);
    useEffect(() => { isSelectingLocationRef.current = isSelectingLocation; }, [isSelectingLocation]);
    useEffect(() => { routeTimeRef.current = instanceData.routeTime; }, [instanceData.routeTime]);

    // search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);

    // map refs
    const mapRef = useRef<HTMLDivElement | null>(null);
    const mapInstance = useRef<any | null>(null); // leaflet Map when loaded
    const markersRef = useRef<Map<number, any>>(new Map());
    const leafletRef = useRef<any | null>(null);
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [mapReady, setMapReady] = useState(false);

    // sync next id based on current nodes (no auto depot)
    useEffect(() => {
        if (nodes.length === 0) {
            setNextNodeId(0);
        } else {
            const maxId = nodes.reduce((m, n) => Math.max(m, n.id), 0);
            setNextNodeId(maxId + 1);
        }
    }, [nodes]);

    const createSampleInstance = useCallback(() => {
        const sampleNodes: NodeRow[] = [
            { id: 0, type: 'depot', lat: 21.0278, lng: 105.8342, demand: 0, earliestTime: 0, latestTime: 1440, serviceDuration: 0 },
            { id: 1, type: 'pickup', lat: 21.03, lng: 105.835, demand: 5, earliestTime: 60, latestTime: 300, serviceDuration: 10, deliveryId: 2 },
            { id: 2, type: 'delivery', lat: 21.032, lng: 105.837, demand: -5, earliestTime: 80, latestTime: 360, serviceDuration: 10, pickupId: 1 },
            { id: 3, type: 'regular', lat: 21.025, lng: 105.83, demand: 3, earliestTime: 0, latestTime: 480, serviceDuration: 5 },
        ];
        setNodes(sampleNodes);
        setInstanceData(prev => ({ ...prev, name: 'sample-instance', location: 'Hanoi', comment: 'Generated sample instance', capacity: 100 }));
        setTimeMatrix([]);
    }, []);

    const generateInstanceFile = useCallback(() => {
        const headerLines: string[] = [];
        headerLines.push(`NAME : ${instanceData.name}`);
        headerLines.push(`LOCATION : ${instanceData.location}`);
        headerLines.push(`TYPE : CVRPTW`);
        headerLines.push(`SIZE : ${nodes.length}`);
        headerLines.push(`CAPACITY : ${instanceData.capacity}`);
        headerLines.push(`NODES`);

        const nodeLines = nodes.map(n => {
            const p = n.pickupId != null ? n.pickupId : 0;
            const d = n.deliveryId != null ? n.deliveryId : 0;
            return `${n.id} ${n.lat.toFixed(6)} ${n.lng.toFixed(6)} ${n.demand} ${n.earliestTime} ${n.latestTime} ${n.serviceDuration} ${p} ${d}`;
        });

        function haversine(a: NodeRow, b: NodeRow) {
            const toRad = (x: number) => (x * Math.PI) / 180;
            const R = 6371;
            const dLat = toRad(b.lat - a.lat);
            const dLon = toRad(b.lng - a.lng);
            const lat1 = toRad(a.lat);
            const lat2 = toRad(b.lat);
            const sinDLat = Math.sin(dLat / 2) ** 2;
            const sinDLon = Math.sin(dLon / 2) ** 2;
            const c = 2 * Math.asin(Math.sqrt(sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon));
            const km = R * c;
            const minutes = Math.max(1, Math.round((km / 50) * 60));
            return minutes;
        }

        let edgesMatrix: number[][];
        if (timeMatrix.length === nodes.length && timeMatrix.every(r => r.length === nodes.length)) {
            edgesMatrix = timeMatrix.map(row => row.map(v => Math.max(0, Math.round(v))));
        } else {
            edgesMatrix = nodes.map((from) => nodes.map((to) => (from.id === to.id ? 0 : haversine(from, to))));
        }
        const edgesLines = edgesMatrix.map(row => row.join(' '));
        const footer = ['EDGES', ...edgesLines, 'EOF'];
        return [...headerLines, ...nodeLines, ...footer].join('\n');
    }, [instanceData, nodes, timeMatrix]);

    const downloadInstanceFile = useCallback(() => {
        const text = generateInstanceFile();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${instanceData.name || 'instance'}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }, [generateInstanceFile, instanceData.name]);

    // Navigate to /map with current instance (store in localStorage)
    const goToMapWithInstance = useCallback(() => {
        const text = generateInstanceFile();
        try {
            localStorage.setItem('builderInstanceText', text);
        } catch (e) {
            console.warn('Không thể lưu instance vào localStorage', e);
        }
        router.push('/map?view=map');
    }, [generateInstanceFile, router]);

    const clearAllNodes = useCallback(() => {
        setNodes([]);
        setTimeMatrix([]);
    }, []);

    const showNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
        setNotification({ type, message });
        window.setTimeout(() => setNotification(null), 3000);
    }, []);

    // Map parsed Instance (from reader) to local builder state
    const applyParsedInstance = useCallback((inst: Instance) => {
        const mappedNodes: NodeRow[] = (inst.nodes || []).map(n => {
            const type: NodeRow['type'] = n.is_depot ? 'depot' : n.is_pickup ? 'pickup' : n.is_delivery ? 'delivery' : 'regular';
            const pickupId = n.is_delivery && n.pair >= 0 ? n.pair : undefined;
            const deliveryId = n.is_pickup && n.pair >= 0 ? n.pair : undefined;
            return {
                id: n.id,
                type,
                lat: n.coords[0],
                lng: n.coords[1],
                demand: n.demand,
                earliestTime: n.time_window?.[0] ?? 0,
                latestTime: n.time_window?.[1] ?? 480,
                serviceDuration: n.duration ?? 0,
                pickupId,
                deliveryId,
            } as NodeRow;
        }).sort((a, b) => a.id - b.id);

        setNodes(mappedNodes);
        if (inst.times && inst.times.length > 0) {
            setTimeMatrix(inst.times);
        } else {
            setTimeMatrix([]);
        }
        setInstanceData(prev => ({
            ...prev,
            name: inst.name || prev.name,
            location: inst.location || prev.location,
            capacity: inst.capacity || prev.capacity,
        }));
        const focus = mappedNodes.find(n => n.type === 'depot') || mappedNodes[0];
        if (focus && mapInstance.current) {
            try {
                mapInstance.current.setView([focus.lat, focus.lng], 13);
            } catch { }
        }
        // keep table in sync if open
        setTableData(mappedNodes.map(n => ({
            id: n.id,
            type: n.type,
            lat: n.lat,
            lng: n.lng,
            demand: n.demand,
            earliestTime: n.earliestTime,
            latestTime: n.latestTime,
            serviceDuration: n.serviceDuration,
            pickupId: n.pickupId || 0,
            deliveryId: n.deliveryId || 0
        })));
        setTableDirty(false);
        showNotification('success', 'Đã load file instance');
    }, [showNotification]);

    const onClickLoadFile = useCallback(() => {
        if (fileInputRef.current) fileInputRef.current.click();
    }, []);

    const onFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.currentTarget.value = '';
        if (!file) return;
        setIsLoadingFile(true);
        try {
            const inst = await readInstanceFile(file);
            applyParsedInstance(inst);
        } catch (err: any) {
            console.error(err);
            showNotification('error', 'Không đọc được file instance');
        } finally {
            setIsLoadingFile(false);
        }
    }, [readInstanceFile, applyParsedInstance, showNotification]);

    // Table helpers
    const createEmptyTableRow = useCallback(() => ({
        id: 0,
        type: 'regular',
        lat: 0,
        lng: 0,
        demand: 0,
        earliestTime: 0,
        latestTime: 480,
        serviceDuration: 0,
        pickupId: 0,
        deliveryId: 0
    }), []);

    const addTableRow = useCallback(() => { setTableData(prev => [...prev, createEmptyTableRow()]); setTableDirty(true); }, [createEmptyTableRow]);
    const removeTableRow = useCallback((index: number) => { setTableData(prev => prev.filter((_, i) => i !== index)); setTableDirty(true); }, []);
    const updateTableRow = useCallback((index: number, field: string, value: any) => { setTableData(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r)); setTableDirty(true); }, []);

    const startLocationSelection = useCallback((rowIndex: number) => {
        setIsSelectingLocation(true);
        isSelectingLocationRef.current = true;
        setSelectedTableRowIndex(rowIndex);
        showNotification('info', 'Chọn vị trí trên bản đồ cho dòng ' + (rowIndex + 1));
    }, [showNotification]);
    const stopLocationSelection = useCallback(() => {
        setIsSelectingLocation(false);
        isSelectingLocationRef.current = false;
        // keep the selected row index for potential further edits rather than clearing immediately
    }, []);

    const searchLocation = useCallback(async (query: string) => {
        if (!query) return;
        setIsSearching(true);
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
            const data = await res.json();
            setSearchResults(data || []);
            setShowSearchResults(true);
        } catch (e) { console.error(e); } finally { setIsSearching(false); }
    }, []);
    const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { setSearchQuery(e.target.value); }, []);
    const selectSearchResult = useCallback((result: any) => {
        setShowSearchResults(false);
        if (!mapInstance.current) return;
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        mapInstance.current.setView([lat, lon], 14);
    }, []);
    const clearSearch = useCallback(() => { setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }, []);

    const applyTableData = useCallback(() => {
        const newNodes: NodeRow[] = tableData.map(r => ({
            id: Number(r.id),
            type: r.type || 'regular',
            lat: Number(r.lat),
            lng: Number(r.lng),
            demand: Number(r.demand || 0),
            earliestTime: Number(r.earliestTime || 0),
            latestTime: Number(r.latestTime || 480),
            serviceDuration: Number(r.serviceDuration || 0),
            pickupId: r.pickupId ? Number(r.pickupId) : undefined,
            deliveryId: r.deliveryId ? Number(r.deliveryId) : undefined
        }));
        setNodes(newNodes.sort((a, b) => a.id - b.id));
        setTimeMatrix([]);
        setShowTableInput(false);
        showNotification('success', 'Đã áp dụng bảng dữ liệu');
    }, [tableData, showNotification]);

    const loadNodesIntoTable = useCallback(() => {
        setTableData(nodes.map(n => ({
            id: n.id,
            type: n.type,
            lat: n.lat,
            lng: n.lng,
            demand: n.demand,
            earliestTime: n.earliestTime,
            latestTime: n.latestTime,
            serviceDuration: n.serviceDuration,
            pickupId: n.pickupId || 0,
            deliveryId: n.deliveryId || 0
        })));
        setTableDirty(false);
        setShowTableInput(true);
    }, [nodes]);

    // Auto-sync table data from nodes when table is visible and user hasn't modified it
    useEffect(() => {
        if (showTableInput && !tableDirty) {
            setTableData(nodes.map(n => ({
                id: n.id,
                type: n.type,
                lat: n.lat,
                lng: n.lng,
                demand: n.demand,
                earliestTime: n.earliestTime,
                latestTime: n.latestTime,
                serviceDuration: n.serviceDuration,
                pickupId: n.pickupId || 0,
                deliveryId: n.deliveryId || 0
            })));
        }
    }, [nodes, showTableInput, tableDirty]);

    // Load Leaflet dynamically on the client and initialize map
    useEffect(() => {
        if (typeof window === 'undefined') return; // never run on server
        let mounted = true;
        (async () => {
            if (leafletRef.current) return;
            // import Leaflet and its CSS dynamically
            const L = await import('leaflet');
            // Leaflet CSS is imported globally in the app layout (src/app/layout.tsx)
            leafletRef.current = L;
            if (!mounted) return;
            setLeafletLoaded(true);
        })();
        return () => { mounted = false; };
    }, []);

    // map init when leaflet is ready
    useEffect(() => {
        if (!leafletLoaded || !leafletRef.current) return;
        if (!mapRef.current || mapInstance.current) return;
        const L = leafletRef.current;
        const initial = nodes[0] || { lat: 21.0278, lng: 105.8342 };
        mapInstance.current = L.map(mapRef.current).setView([initial.lat, initial.lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(mapInstance.current);
        mapInstance.current.on('click', (e: any) => {
            const { lat, lng } = e.latlng;
            if (isSelectingLocationRef.current && selectedRowIndexRef.current != null) {
                const idx = selectedRowIndexRef.current;
                setTableData(prev => prev.map((r, i) => i === idx ? { ...r, lat, lng } : r));
                setTableDirty(true);
                stopLocationSelection();
            } else if (isAddingNodeRef.current) {
                setNodes(prev => {
                    const nextIdLocal = prev.length === 0 ? 0 : prev.reduce((m, n) => Math.max(m, n.id), 0) + 1;
                    return [...prev, { id: nextIdLocal, type: 'regular', lat, lng, demand: 1, earliestTime: 0, latestTime: routeTimeRef.current, serviceDuration: 5 }];
                });
                setNextNodeId(id => id + 1);
                setTimeMatrix([]);
            }
        });
        setMapReady(true);
        return () => { try { mapInstance.current?.remove(); } catch { } mapInstance.current = null; setMapReady(false); };
    }, [leafletLoaded, mapRef.current]);

    // update markers & lines between paired pickup-delivery
    const pairLinesRef = useRef<any[]>([]);
    const popupRootsRef = useRef<Map<number, any>>(new Map());
    const popupResizeObsRef = useRef<Map<number, ResizeObserver>>(new Map());
    useEffect(() => {
        if (!mapInstance.current || !mapReady) return;
        // clear markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current.clear();
        // clear existing lines
        pairLinesRef.current.forEach(l => l.remove());
        pairLinesRef.current = [];
        // add markers
        const L = leafletRef.current;
        if (!L) return;
        nodes.forEach(n => {
            const selected = editingNode && editingNode.id === n.id;
            const color = n.type === 'depot' ? '#000000' : n.type === 'pickup' ? '#2563eb' : n.type === 'delivery' ? '#dc2626' : '#6b7280';
            const icon = L.divIcon({
                className: 'node-marker',
                html: `<div class="node-marker-inner ${selected ? 'selected' : ''}" style="background:${color};border:2px solid #ffffff;color:#fff;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:11px;font-weight:600;box-shadow:0 0 0 2px ${color}33;">${n.id}</div>`,
                // Move popup to the right of the marker. Adjust X to half icon width + small gap.
                popupAnchor: [18, 0]
            });
            const marker = L.marker([n.lat, n.lng], { title: `#${n.id}`, icon }).addTo(mapInstance.current!);
            // Bind popup container for React content
            const container = document.createElement('div');
            container.style.width = '100%';
            // Force popup to open on the right side of the marker by setting a rightward offset
            // and disabling Leaflet's auto-pan / keepInView behavior which can flip placement.
            marker.bindPopup(container, {
                minWidth: 180,
                maxWidth: 260,
                closeButton: true,
                autoClose: true,
                className: 'node-popup',
                // disable automatic re-positioning so popup stays where we anchor it
                keepInView: false,
                autoPan: false,
                // offset the popup to the right
                offset: L.point(24, 0)
            });
            marker.on('click', () => {
                // Only update when selection actually changes to avoid unnecessary rerenders
                setEditingNode(prev => (prev?.id === n.id ? prev : n));
            });
            marker.on('popupopen', () => {
                try {
                    // Lazy import to avoid SSR issues at module init
                    const { createRoot } = require('react-dom/client');
                    let root = popupRootsRef.current.get(n.id);
                    if (!root) {
                        root = createRoot(container);
                        popupRootsRef.current.set(n.id, root);
                    }
                    const onClose = () => { try { marker.closePopup(); } catch { } };
                    root.render(
                        <NodeDetailsPanel
                            variant="popover"
                            node={n}
                            nodes={nodes}
                            onUpdate={handleNodeUpdate}
                            onDelete={handleNodeDelete}
                            showNotification={showNotification}
                            onClose={onClose}
                        />
                    );
                    // Defer an update so Leaflet measures after React paints
                    setTimeout(() => { try { marker.getPopup()?.update(); } catch { } }, 0);
                    // Observe size changes and update popup layout
                    const obs = new ResizeObserver(() => { try { marker.getPopup()?.update(); } catch { } });
                    obs.observe(container);
                    popupResizeObsRef.current.set(n.id, obs);
                } catch { }
            });
            marker.on('popupclose', () => {
                const root = popupRootsRef.current.get(n.id);
                if (root) {
                    // Defer unmount to avoid overlapping with React render
                    setTimeout(() => { try { root.unmount(); } catch { } }, 0);
                    popupRootsRef.current.delete(n.id);
                }
                const obs = popupResizeObsRef.current.get(n.id);
                if (obs) {
                    try { obs.disconnect(); } catch { }
                    popupResizeObsRef.current.delete(n.id);
                }
                setEditingNode(prev => (prev?.id === n.id ? null : prev));
            });
            markersRef.current.set(n.id, marker);
        });
        // draw lines for pairs: either pickup->delivery or via mutual references
        nodes.forEach(p => {
            if (p.type === 'pickup' && p.deliveryId) {
                const d = nodes.find(n => n.id === p.deliveryId);
                if (d && d.type === 'delivery') {
                    const line = L.polyline([[p.lat, p.lng], [d.lat, d.lng]], { color: '#0d9488', weight: 2 }).addTo(mapInstance.current!);
                    pairLinesRef.current.push(line);
                }
            }
            if (p.type === 'delivery' && p.pickupId) {
                const pick = nodes.find(n => n.id === p.pickupId);
                if (pick && pick.type === 'pickup' && !pick.deliveryId) {
                    // delivery references pickup but pickup not yet set its deliveryId
                    const line = L.polyline([[pick.lat, pick.lng], [p.lat, p.lng]], { color: '#0d9488', weight: 2 }).addTo(mapInstance.current!);
                    pairLinesRef.current.push(line);
                }
            }
        });
    }, [nodes, mapReady]);

    // Update marker icons when selection changes without rebuilding markers/popups
    useEffect(() => {
        if (!mapReady || !leafletRef.current) return;
        const L = leafletRef.current;
        nodes.forEach(n => {
            const marker = markersRef.current.get(n.id);
            if (!marker) return;
            const selected = editingNode && editingNode.id === n.id;
            const color = n.type === 'depot' ? '#000000' : n.type === 'pickup' ? '#2563eb' : n.type === 'delivery' ? '#dc2626' : '#6b7280';
            const icon = L.divIcon({
                className: 'node-marker',
                html: `<div class="node-marker-inner ${selected ? 'selected' : ''}" style="background:${color};border:2px solid #ffffff;color:#fff;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:11px;font-weight:600;box-shadow:0 0 0 2px ${color}33;">${n.id}</div>`,
                popupAnchor: [18, 0]
            });
            try { marker.setIcon(icon); } catch { /* ignore */ }
        });
    }, [editingNode, nodes, mapReady]);

    const handleNodeUpdate = useCallback((updatedNode: NodeRow) => {
        setNodes(prev => {
            let next = prev.map(n => n.id === updatedNode.id ? updatedNode : n);
            // If delivery updated with pickupId ensure corresponding pickup has deliveryId
            if (updatedNode.type === 'delivery' && updatedNode.pickupId) {
                next = next.map(n => (n.id === updatedNode.pickupId && n.type === 'pickup') ? { ...n, deliveryId: updatedNode.id } : n);
            }
            // If pickup updated and deliveryId removed, clear delivery's pickupId
            if (updatedNode.type === 'pickup') {
                if (!updatedNode.deliveryId) {
                    next = next.map(n => (n.type === 'delivery' && n.pickupId === updatedNode.id) ? { ...n, pickupId: undefined } : n);
                }
            }
            return next;
        });
        setEditingNode(null);
        setTimeMatrix([]); // matrix invalidated
        showNotification('success', 'Node updated');
    }, [showNotification]);
    const handleNodeDelete = useCallback((nodeId: number) => {
        setNodes(prev => prev.filter(n => n.id !== nodeId));
        setEditingNode(null);
        setTimeMatrix([]);
        showNotification('info', 'Node deleted');
    }, [showNotification]);
    const updateNode = useCallback((id: number, patch: Partial<NodeRow>) => { setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n)); setTimeMatrix([]); }, []);
    const addNode = useCallback(() => {
        setNodes(prev => {
            const nextIdLocal = prev.length === 0 ? 0 : prev.reduce((m, n) => Math.max(m, n.id), 0) + 1;
            const baseLat = prev[0]?.lat ?? 21.0278;
            const baseLng = prev[0]?.lng ?? 105.8342;
            return [...prev, { id: nextIdLocal, type: 'regular', lat: baseLat + 0.001 * (nextIdLocal), lng: baseLng + 0.001 * (nextIdLocal), demand: 1, earliestTime: 0, latestTime: 480, serviceDuration: 5 }];
        });
        setNextNodeId(id => id + 1);
        setTimeMatrix([]);
        if (showTableInput) {
            // resync table from nodes on next render via effect; also consider table clean
            setTableDirty(false);
        }
    }, []);

    // Time matrix generation using OSRM public API
    const generateTimeMatrix = useCallback(async () => {
        if (nodes.length === 0) return;
        setIsGeneratingMatrix(true);
        setMatrixGenerationProgress(0);
        try {
            const coords = nodes.map(n => `${n.lng.toFixed(6)},${n.lat.toFixed(6)}`).join(';');
            const url = `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('OSRM request failed');
            const data = await res.json();
            if (data.durations && Array.isArray(data.durations)) {
                const matrix: number[][] = data.durations.map((row: number[]) => row.map((v: number) => Math.max(0, Math.round(v / 60))));
                setTimeMatrix(matrix);
                showNotification('success', 'Đã tạo time matrix (OSRM)');
            } else {
                showNotification('error', 'OSRM không trả về durations');
            }
        } catch (e) {
            console.error(e);
            showNotification('error', 'Lỗi tạo time matrix');
        } finally {
            setIsGeneratingMatrix(false);
            setMatrixGenerationProgress(1);
        }
    }, [nodes, showNotification]);

    const clearTimeMatrix = useCallback(() => {
        setTimeMatrix([]);
        showNotification('info', 'Đã xóa time matrix');
    }, [showNotification]);

    const instancePreview = useMemo(() => generateInstanceFile(), [generateInstanceFile]);

    // local UI: collapse left settings sidebar
    const [settingsCollapsed, setSettingsCollapsed] = useState(false);

    return (
        <div className="flex flex-col h-screen">
            {notification && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${notification.type === 'success' ? 'bg-green-500 text-white' : notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">{notification.message}</span>
                        <button onClick={() => setNotification(null)} className="ml-2 text-white">✕</button>
                    </div>
                </div>
            )}
            {/* Tool bar */}
            <div className="bg-white border-b px-4 py-1 flex items-center gap-4">
                {/* Left group: back + name/location */}
                {onBack && (
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={onBack}
                            title="Quay về Dashboard"
                            className="flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition"
                        >
                            <ArrowLeftToLine className="mr-2" />
                            <span>Dashboard</span>
                        </button>
                        <div className="text-sm w-48 text-gray-600 hidden md:block">
                            <div className="font-medium truncate max-w-[180px]">{instanceData.name}</div>
                            <div className="text-xs truncate max-w-[180px]">{instanceData.location || 'Chưa có địa điểm'}</div>
                        </div>
                    </div>
                )}
                {/* Toolbar */}
                <div className="flex-1 flex justify-start items-center space-x-4">
                    {/* Grouped actions: Add Node / Time Matrix / Sample */}
                    <div className="flex items-center space-x-3 mr-6">
                        <div className="flex items-center space-x-2">
                            {/* Add node */}
                            <button
                                onClick={() => setIsAddingNode(v => !v)}
                                title={isAddingNode ? 'Hủy thêm node (click để hủy)' : 'Click để thêm node trên bản đồ'}
                                className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border ${isAddingNode ? 'bg-red-500 border-red-600 text-white' : 'bg-blue-50 border-blue-500 border-2 text-blue-600 hover:bg-blue-100'}`}
                            >
                                {isAddingNode ? <X size={24} /> : <MapPinPlus size={24} />}
                                <span className="text-[12px] mt-1">{isAddingNode ? 'Hủy' : 'Thêm điểm'}</span>
                            </button>

                            {/* Table Input */}
                            <button
                                onClick={() => {
                                    setShowTableInput(v => {
                                        const next = !v;
                                        if (next) {
                                            // opening: load fresh from nodes
                                            setTableData(nodes.map(n => ({
                                                id: n.id,
                                                type: n.type,
                                                lat: n.lat,
                                                lng: n.lng,
                                                demand: n.demand,
                                                earliestTime: n.earliestTime,
                                                latestTime: n.latestTime,
                                                serviceDuration: n.serviceDuration,
                                                pickupId: n.pickupId || 0,
                                                deliveryId: n.deliveryId || 0
                                            })));
                                            setTableDirty(false);
                                        }
                                        return next;
                                    });
                                }}
                                title={showTableInput ? "Đóng bảng" : "Mở bảng"}
                                className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border ${showTableInput ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-50 hover:bg-gray-100 text-purple-600'}`}
                            >
                                {showTableInput ? <Grid2x2X size={24} /> : <Grid2x2Plus size={24} />}
                                <span className="text-[12px] mt-1">{showTableInput ? 'Đóng bảng' : 'Bảng nhập'}</span>
                            </button>

                            {/* Sample Instance */}
                            <button
                                onClick={createSampleInstance}
                                title="Tạo mẫu"
                                className="w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border bg-gray-50 hover:bg-gray-100 text-indigo-600"
                            >
                                <WandSparkles size={24} />
                                <span className="text-[12px] mt-1">Tạo mẫu</span>
                            </button>

                            <div className='border-l-1 border-gray-200 pl-2'>
                                {/* Clear All Nodes */}
                                <button
                                    onClick={clearAllNodes}
                                    disabled={nodes.length === 0}
                                    className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border bg-gray-50 text-red-600 hover:bg-red-500 hover:text-white`}
                                    title="Xóa tất cả nodes"
                                >
                                    <MapPinXInside size={24} />
                                    <span className="text-[12px] mt-1">Xóa hết</span>
                                </button>
                            </div>
                        </div>

                        <TimeMatrixControls
                            nodesLength={nodes.length}
                            isGenerating={isGeneratingMatrix}
                            matrixLength={timeMatrix.length}
                            progress={matrixGenerationProgress}
                            onGenerate={generateTimeMatrix}
                            onClear={clearTimeMatrix}
                        />
                    </div>
                </div>

                {/* Download and Load buttons */}
                <div className="flex items-center space-x-2">
                    {/* Hidden file input for loading instance */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.vrp,.vrptw,.dat,text/plain"
                        className="hidden"
                        onChange={onFileSelected}
                    />
                    <button
                        onClick={onClickLoadFile}
                        disabled={isLoadingFile}
                        className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60`}
                        title="Load file instance để chỉnh sửa tiếp"
                    >
                        {isLoadingFile ? <LoaderCircle size={24} /> : <FileCode size={24} />}
                        <span className="text-[12px] mt-1">Load File</span>
                    </button>
                    <button
                        onClick={downloadInstanceFile}
                        className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border bg-blue-600 text-white hover:bg-blue-700`}
                        title="Tải file instance"
                    >
                        <Download size={24} />
                        <span className="text-[12px] mt-1">Tải xuống</span>
                    </button>
                    <button
                        onClick={goToMapWithInstance}
                        className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border bg-green-600 text-white hover:bg-green-700`}
                        title="Mở /map với instance hiện tại"
                    >
                        <Play size={24} />
                        <span className="text-[12px] mt-1">Load App</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left settings panel (collapsible) */}
                <InstanceSettingsPanel
                    settingsCollapsed={settingsCollapsed}
                    onSetCollapsed={setSettingsCollapsed}
                    isAddingNode={isAddingNode}
                    onToggleAddNode={() => setIsAddingNode(v => !v)}
                    instanceData={instanceData}
                    onUpdateInstance={(patch) => setInstanceData(prev => ({ ...prev, ...patch }))}
                    nodes={nodes}
                    updateNode={updateNode}
                    timeMatrixLength={timeMatrix.length}
                    isGeneratingMatrix={isGeneratingMatrix}
                    matrixGenerationProgress={matrixGenerationProgress}
                    instancePreview={instancePreview}
                />
                {/* Map panel */}
                <div className="flex-1 bg-gray-50 relative">
                    {(isAddingNode || isSelectingLocation) && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none">
                            <div className="flex items-center space-x-2">
                                <i className="fas fa-crosshairs animate-pulse"></i>
                                <span className="font-medium text-xs">
                                    {isAddingNode ? 'Click vào bản đồ để thêm node' : isSelectingLocation && selectedTableRowIndex != null ? `Chọn vị trí cho dòng ${selectedTableRowIndex + 1}` : ''}
                                </span>
                            </div>
                        </div>
                    )}
                    <div className="absolute top-4 right-4 w-80" style={{ zIndex: 9999 }}>
                        <div className="relative">
                            <div className="flex">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={handleSearchInputChange}
                                        placeholder="Hoàn Kiếm, Hà Nội..."
                                        className="w-full px-4 py-2 pr-10 text-sm bg-white border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-lg"
                                    />
                                    {isSearching && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                            <i className="fas fa-spinner animate-spin text-gray-400"></i>
                                        </div>
                                    )}
                                    {searchQuery && !isSearching && (
                                        <button onClick={clearSearch} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
                                    )}
                                </div>
                                <button onClick={() => searchLocation(searchQuery)} disabled={!searchQuery || isSearching} className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transition-colors">
                                    <i className="fas fa-search"></i>
                                </button>
                            </div>
                            {showSearchResults && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto z-30">
                                    {searchResults.map((result, index) => (
                                        <div key={index} onClick={() => selectSearchResult(result)} className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                                            <div className="text-sm font-medium text-gray-900 truncate">{(result.display_name || '').split(',')[0]}</div>
                                            <div className="text-xs text-gray-500 truncate">{result.display_name}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div ref={mapRef} className="absolute inset-0" style={{ cursor: isSelectingLocation || isAddingNode ? 'crosshair' : 'default' }} />
                </div>
                {/* Right node editor panel removed (using popovers on markers instead) */}
            </div>

            {showTableInput && (
                <NodeTableInput
                    rows={tableData}
                    isDirty={tableDirty}
                    isSelecting={isSelectingLocation}
                    selectedIndex={selectedTableRowIndex}
                    onAddRow={addTableRow}
                    onRemoveRow={(index) => removeTableRow(index)}
                    onChangeCell={(index, key, value) => updateTableRow(index, key as any, value)}
                    onApply={applyTableData}
                    onStartPick={(index) => startLocationSelection(index)}
                    onCancelPick={stopLocationSelection}
                    onClose={() => setShowTableInput(false)}
                />
            )}
        </div >
    );
};

export default AddInstanceBuilder;
