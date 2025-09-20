"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeRow } from './NodeEditor';
import { Link as LinkIcon } from 'lucide-react';

type ShowNotification = (type: 'success' | 'error' | 'info', message: string) => void;

export interface LinkNodesToolProps {
    mapInstanceRef: React.MutableRefObject<any | null>;
    leafletRef: React.MutableRefObject<any | null>;
    markersRef: React.MutableRefObject<Map<number, any>>;
    nodes: NodeRow[];
    setNodes: React.Dispatch<React.SetStateAction<NodeRow[]>>;
    mapReady: boolean;
    showNotification: ShowNotification;
    // Helpers to disable other modes for clarity when enabling link mode
    onDeactivateOtherModes?: () => void; // should stop add-node, stop location selection, and turn off inspector
    // Optional tuning for slow auto-pan behavior (pixels)
    autoPanEdgePx?: number;   // distance from edge to trigger pan (default 40)
    autoPanStepPx?: number;   // how much to pan per tick (default 20)
    autoPanThrottleMs?: number; // min ms between pans (default 40)
}

const LinkNodesTool: React.FC<LinkNodesToolProps> = ({
    mapInstanceRef,
    leafletRef,
    markersRef,
    nodes,
    setNodes,
    mapReady,
    showNotification,
    onDeactivateOtherModes,
    autoPanEdgePx,
    autoPanStepPx,
    autoPanThrottleMs,
}) => {
    const [isLinking, setIsLinking] = useState(false);
    const isLinkingRef = useRef(false);
    const nodesRef = useRef(nodes);
    const linkingDragRef = useRef<{ active: boolean; fromId: number | null; tempLine: any | null }>({ active: false, fromId: null, tempLine: null });
    const mapDraggingPrevRef = useRef<boolean | null>(null);
    const autoPanLastTsRef = useRef<number>(0);

    useEffect(() => { isLinkingRef.current = isLinking; }, [isLinking]);
    useEffect(() => { nodesRef.current = nodes; }, [nodes]);

    const cancelLinkingDrag = useCallback((silent = false) => {
        const st = linkingDragRef.current;
        try { st.tempLine?.remove(); } catch { }
        linkingDragRef.current = { active: false, fromId: null, tempLine: null };
        // restore map dragging
        try {
            const map = mapInstanceRef.current;
            if (map && mapDraggingPrevRef.current !== null) {
                if (mapDraggingPrevRef.current) map.dragging.enable(); else map.dragging.disable();
                mapDraggingPrevRef.current = null;
            }
        } catch { }
        if (!silent) showNotification('info', 'Đã hủy nối điểm');
    }, [mapInstanceRef, showNotification]);

    const finishLinking = useCallback((fromId: number, toId: number) => {
        setNodes(prev => {
            let next = [...prev];
            const fromIdx = next.findIndex(n => n.id === fromId);
            const toIdx = next.findIndex(n => n.id === toId);
            if (fromIdx < 0 || toIdx < 0) return prev;
            const from = next[fromIdx];
            const to = next[toIdx];
            // Validate: from cannot be depot/delivery; to cannot be depot/pickup
            if (from.type === 'depot' || from.type === 'delivery') return prev;
            if (to.type === 'depot' || to.type === 'pickup') return prev;
            // Clear previous links if any
            if (from.deliveryId && from.deliveryId !== toId) {
                next = next.map(n => (n.id === from.deliveryId && n.type === 'delivery') ? { ...n, pickupId: undefined } : n);
            }
            if (to.pickupId && to.pickupId !== fromId) {
                next = next.map(n => (n.id === to.pickupId && n.type === 'pickup') ? { ...n, deliveryId: undefined } : n);
            }
            // Apply type conversions if needed and new link
            const newFrom: NodeRow = { ...from, type: from.type === 'regular' ? 'pickup' : from.type, deliveryId: toId } as NodeRow;
            const newTo: NodeRow = { ...to, type: to.type === 'regular' ? 'delivery' : to.type, pickupId: fromId } as NodeRow;
            next[fromIdx] = newFrom;
            next[toIdx] = newTo;
            return next;
        });
        showNotification('success', `Đã ghép pickup #${fromId} → delivery #${toId}`);
        cancelLinkingDrag(true);
        // ensure map dragging restored
        try {
            const map = mapInstanceRef.current;
            if (map && mapDraggingPrevRef.current !== null) {
                if (mapDraggingPrevRef.current) map.dragging.enable(); else map.dragging.disable();
                mapDraggingPrevRef.current = null;
            }
        } catch { }
    }, [cancelLinkingDrag, mapInstanceRef, setNodes, showNotification]);

    // ESC to cancel
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && linkingDragRef.current.active) {
                e.preventDefault();
                cancelLinkingDrag();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('keydown', onKey); };
    }, [cancelLinkingDrag]);

    // When turning off linking while dragging -> cancel
    useEffect(() => {
        if (!isLinking && linkingDragRef.current.active) {
            cancelLinkingDrag(true);
        }
    }, [isLinking, cancelLinkingDrag]);

    // Map-level handlers for cancel and slow auto-pan
    useEffect(() => {
        if (!mapReady || !mapInstanceRef.current) return;
        const map = mapInstanceRef.current;
        const onMapClick = (e: any) => {
            if (isLinkingRef.current && linkingDragRef.current.active) {
                cancelLinkingDrag();
            }
        };
        const onMapMouseUp = () => {
            if (isLinkingRef.current && linkingDragRef.current.active) {
                cancelLinkingDrag(true);
            }
        };
        const onMoveForLink = (e: any) => {
            if (!isLinkingRef.current) return;
            const st = linkingDragRef.current;
            if (!st.active || !st.tempLine) return;
            const from = nodesRef.current.find(nn => nn.id === st.fromId);
            if (!from) return;
            try { st.tempLine.setLatLngs([[from.lat, from.lng], [e.latlng.lat, e.latlng.lng]]); } catch { }
            // Slow auto-pan when cursor near map edges
            try {
                const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
                const throttleMs = (typeof autoPanThrottleMs === 'number' ? autoPanThrottleMs : 40);
                if (now - autoPanLastTsRef.current < throttleMs) return;
                const size = map.getSize();
                const pt = e.containerPoint || map.latLngToContainerPoint(e.latlng);
                const edge = (typeof autoPanEdgePx === 'number' ? autoPanEdgePx : 40); // px from edge to trigger
                let dx = 0, dy = 0;
                const step = (typeof autoPanStepPx === 'number' ? autoPanStepPx : 20); // pan step in px
                if (pt.x < edge) dx = -step;
                else if (pt.x > size.x - edge) dx = step;
                if (pt.y < edge) dy = -step;
                else if (pt.y > size.y - edge) dy = step;
                if (dx !== 0 || dy !== 0) {
                    autoPanLastTsRef.current = now;
                    map.panBy([dx, dy], { animate: true, duration: 0.2, easeLinearity: 0.25 });
                }
            } catch { }
        };
        map.on('click', onMapClick);
        map.on('mouseup', onMapMouseUp);
        map.on('mousemove', onMoveForLink);
        return () => {
            try { map.off('click', onMapClick); } catch { }
            try { map.off('mouseup', onMapMouseUp); } catch { }
            try { map.off('mousemove', onMoveForLink); } catch { }
        };
    }, [mapReady, mapInstanceRef, cancelLinkingDrag]);

    // Marker-level handlers for starting and finishing link
    useEffect(() => {
        if (!mapReady || !leafletRef.current) return;
        const L = leafletRef.current;
        nodes.forEach(n => {
            const marker = markersRef.current.get(n.id);
            if (!marker) return;
            // Bind once per marker instance
            const key = '__linkHandlersBound';
            if ((marker as any)[key]) return;
            (marker as any)[key] = true;

            marker.on('mousedown', (e: any) => {
                if (!isLinkingRef.current) return;
                try { e.originalEvent?.preventDefault(); e.originalEvent?.stopPropagation(); } catch { }
                if (n.type !== 'pickup' && n.type !== 'regular') {
                    showNotification('error', 'Điểm bắt đầu phải là pickup hoặc regular');
                    return;
                }
                try { mapInstanceRef.current?.closePopup(); } catch { }
                // create a temp green line
                try {
                    const line = L.polyline([[n.lat, n.lng], [n.lat, n.lng]], { color: '#22c55e', weight: 3, opacity: 0.9 }).addTo(mapInstanceRef.current!);
                    linkingDragRef.current = { active: true, fromId: n.id, tempLine: line };
                } catch {
                    linkingDragRef.current = { active: true, fromId: n.id, tempLine: null };
                }
                // Disable default map dragging while we manage slow autopan
                try {
                    const map = mapInstanceRef.current;
                    if (map) {
                        mapDraggingPrevRef.current = map.dragging.enabled();
                        map.dragging.disable();
                    }
                } catch { }
            });

            marker.on('mouseup', (e: any) => {
                if (!isLinkingRef.current || !linkingDragRef.current.active) return;
                const st = linkingDragRef.current;
                if (!st.fromId || st.fromId === n.id) { cancelLinkingDrag(); return; }
                const from = nodesRef.current.find(nn => nn.id === st.fromId);
                const to = n;
                if (!from) { cancelLinkingDrag(); return; }
                if (to.type !== 'delivery' && to.type !== 'regular') {
                    showNotification('error', 'Điểm kết thúc phải là delivery hoặc regular');
                    cancelLinkingDrag(true);
                    return;
                }
                try { e.originalEvent?.preventDefault(); e.originalEvent?.stopPropagation(); } catch { }
                finishLinking(from.id, to.id);
            });
        });
    }, [nodes, mapReady, leafletRef, markersRef, finishLinking, cancelLinkingDrag, showNotification, mapInstanceRef]);

    const onToggle = useCallback(() => {
        setIsLinking(v => {
            const next = !v;
            if (next) onDeactivateOtherModes?.();
            return next;
        });
    }, [onDeactivateOtherModes]);

    return (
        <>
            {/* Toolbar Button */}
            <button
                onClick={onToggle}
                title="Kéo từ điểm pickup/regular đến điểm delivery/regular để ghép cặp"
                className={`w-18 h-16 flex flex-col items-center justify-end pb-1 rounded-md transition-colors border ${isLinking ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 border-green-500 hover:bg-green-100'}`}
            >
                <LinkIcon size={24} />
                <span className="text-[12px] mt-1">{isLinking ? 'Đang nối' : 'Nối điểm'}</span>
            </button>

            {/* Floating hint when linking */}
            {isLinking && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none">
                    <div className="flex items-center space-x-2">
                        <i className="fas fa-crosshairs animate-pulse"></i>
                        <span className="font-medium text-xs">Kéo từ pickup/regular đến delivery/regular để ghép cặp</span>
                    </div>
                </div>
            )}
        </>
    );
};

export default LinkNodesTool;
