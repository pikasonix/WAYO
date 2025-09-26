"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, closestCenter, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MapPin, Plus, ArrowUpDown, X } from 'lucide-react';
import { formatDuration, formatDistance, formatInstructionVI } from './formatters';
import config from '@/config/config';
import { getGeocoder, type Suggestion } from '@/services/geocoding';

type Profile = 'driving' | 'walking' | 'cycling';

const SUGGEST_DEBOUNCE_MS = 600;

type ControlsPanelProps = {
    profile: Profile;
    setProfile: (p: Profile) => void;
    isRouting: boolean;
    calculateRoute: () => void;
    instructions: any[];
    routeSummary: { distanceKm: number; durationMin: number } | null;
    activeStepIdx: number | null;
    focusStep: (idx: number) => void;
    onStartGuidance: () => void;
    startPoint: { lat: number; lng: number } | null;
    endPoint: { lat: number; lng: number } | null;
    waypoints: Array<{ lat: number; lng: number }>;
    startLabel?: string;
    endLabel?: string;
    waypointLabels?: string[];
    setWaypointLabels: React.Dispatch<React.SetStateAction<string[]>>;
    setStartPoint: (p: { lat: number; lng: number } | null) => void;
    setEndPoint: (p: { lat: number; lng: number } | null) => void;
    setWaypoints: (wps: Array<{ lat: number; lng: number }>) => void;
    onPickStart: () => void;
    onPickEnd: () => void;
    onPickWaypoint: (index: number) => void;
    focusOnCoordinate: (coords: { lat: number; lng: number }) => void;
};

// Move SortableWaypoint outside of ControlsPanel
const SortableWaypoint: React.FC<{
    idStr: string;
    idx: number;
    txt: string;
    waypoints: Array<{ lat: number; lng: number }>;
    setWaypoints: (wps: Array<{ lat: number; lng: number }>) => void;
    waypointTexts: string[];
    setWaypointTexts: React.Dispatch<React.SetStateAction<string[]>>;
    isEditingWaypoint: boolean[];
    setIsEditingWaypoint: React.Dispatch<React.SetStateAction<boolean[]>>;
    loadingWaypoint: boolean[];
    setLoadingWaypoint: React.Dispatch<React.SetStateAction<boolean[]>>;
    waypointSugs: Record<number, Suggestion[]>;
    setWaypointSugs: React.Dispatch<React.SetStateAction<Record<number, Suggestion[]>>>;
    onPickWaypoint: (idx: number) => void;
    onRemoveWaypoint: (idx: number) => void;
    onSearchWaypoint: (idx: number) => void;
    onChangeWaypointText: (idx: number, val: string) => void;
    dragOverId: string | null;
    isDragging: boolean;
    geocodeSuggest: (query: string) => Promise<Suggestion[]>;
    waypointTimerRef: React.MutableRefObject<Record<number, number>>;
    waypointPendingQueryRef: React.MutableRefObject<Record<number, string>>;
    focusOnCoordinate: (coords: { lat: number; lng: number }) => void;
}> = React.memo(({
    idStr, idx, txt, waypoints, setWaypoints, waypointTexts, setWaypointTexts,
    isEditingWaypoint, setIsEditingWaypoint, loadingWaypoint, setLoadingWaypoint,
    waypointSugs, setWaypointSugs, onPickWaypoint, onRemoveWaypoint, onSearchWaypoint,
    onChangeWaypointText, dragOverId, isDragging, geocodeSuggest,
    waypointTimerRef, waypointPendingQueryRef, focusOnCoordinate
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging: itemIsDragging } = useSortable({
        id: idStr,
        disabled: !!isEditingWaypoint[idx]
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: itemIsDragging ? 0.5 : 1,
        zIndex: itemIsDragging ? 1000 : 1,
    };

    const isDropTarget = dragOverId === idStr && isDragging;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 transition-all duration-200 ${isDropTarget ? 'bg-blue-50 border border-blue-300 rounded-lg shadow-md' : ''} ${itemIsDragging ? 'shadow-lg' : ''}`}
        >
            <button
                className={`p-1 cursor-grab active:cursor-grabbing rounded hover:bg-gray-100 transition-colors ${itemIsDragging ? 'bg-blue-100' : 'text-gray-400 hover:text-gray-600'}`}
                title="Kéo để sắp xếp"
                {...attributes}
                {...listeners}
            >
                <GripVertical size={16} />
            </button>
            <div className="w-6 h-6 rounded-full bg-gray-400 text-white text-xs font-bold flex items-center justify-center" title={`Trung gian ${idx + 2}`}>
                {idx + 2}
            </div>
            <div className="relative flex-1">
                <input
                    className="w-full border rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Điểm trung gian hoặc Lat,Lng"
                    value={txt}
                    onFocus={() => setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? true : v))}
                    onBlur={() => setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? false : v))}
                    onChange={(e) => {
                        const val = e.target.value;
                        onChangeWaypointText(idx, val);
                        const trimmed = val.trim();
                        waypointPendingQueryRef.current[idx] = trimmed;
                        const prevT = waypointTimerRef.current[idx];
                        if (prevT) window.clearTimeout(prevT);
                        waypointTimerRef.current[idx] = window.setTimeout(async () => {
                            const query = waypointPendingQueryRef.current[idx];
                            if (!query || query.length < 2) {
                                setWaypointSugs((m) => ({ ...m, [idx]: [] }));
                                return;
                            }
                            const sugs = await geocodeSuggest(query);
                            if (waypointPendingQueryRef.current[idx] === query) {
                                setWaypointSugs((m) => ({ ...m, [idx]: sugs }));
                            }
                        }, SUGGEST_DEBOUNCE_MS);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onSearchWaypoint(idx);
                        }
                    }}
                />
                {(waypointSugs[idx]?.length || 0) > 0 && (
                    <div className="absolute top-full left-0 right-20 mt-1 bg-white border border-gray-200 rounded shadow-lg z-[500] max-h-56 overflow-auto">
                        {(waypointSugs[idx] || []).map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => {
                                    const next = [...waypoints];
                                    next[idx] = { lat: s.center[1], lng: s.center[0] };
                                    setWaypoints(next);
                                    setWaypointTexts(prev => prev.map((t, i) => i === idx ? s.place_name : t));
                                    setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
                                    setWaypointSugs((m) => ({ ...m, [idx]: [] }));
                                }}
                            >
                                {s.place_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <button
                className="shrink-0 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs px-2.5 py-1.5 rounded flex items-center gap-1"
                onClick={() => {
                    setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
                    onPickWaypoint(idx);
                }}
                title="Chọn trên bản đồ"
                disabled={loadingWaypoint[idx]}
            >
                {loadingWaypoint[idx] ? '…' : <MapPin size={14} />}
            </button>
            <button
                className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white text-xs px-2.5 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                    const point = waypoints[idx];
                    if (point) focusOnCoordinate(point);
                }}
                title="Phóng tới vị trí điểm trung gian"
                disabled={loadingWaypoint[idx] || !waypoints[idx]}
            >
                {loadingWaypoint[idx] ? 'Đang tìm…' : 'Tìm'}
            </button>
            <button
                className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs px-2.5 py-1.5 rounded flex items-center"
                onClick={() => onRemoveWaypoint(idx)}
                title="Xóa điểm này"
            >
                <X size={14} />
            </button>
        </div>
    );
});

SortableWaypoint.displayName = 'SortableWaypoint';

// Move SortableStartRow outside of ControlsPanel
const SortableStartRow: React.FC<{
    startText: string;
    setStartText: React.Dispatch<React.SetStateAction<string>>;
    setStartPoint: (p: { lat: number; lng: number } | null) => void;
    isEditingStart: boolean;
    setIsEditingStart: React.Dispatch<React.SetStateAction<boolean>>;
    loadingStart: boolean;
    startSugs: Suggestion[];
    setStartSugs: React.Dispatch<React.SetStateAction<Suggestion[]>>;
    onPickStart: () => void;
    onSearchStart: () => void;
    dragOverId: string | null;
    isDragging: boolean;
    geocodeSuggest: (query: string) => Promise<Suggestion[]>;
    startTimerRef: React.MutableRefObject<number | null>;
    startPendingQueryRef: React.MutableRefObject<string>;
    currentPoint: { lat: number; lng: number } | null;
    focusOnCoordinate: (coords: { lat: number; lng: number }) => void;
}> = React.memo(({
    startText, setStartText, setStartPoint, isEditingStart, setIsEditingStart,
    loadingStart, startSugs, setStartSugs, onPickStart, onSearchStart,
    dragOverId, isDragging, geocodeSuggest, startTimerRef, startPendingQueryRef,
    currentPoint, focusOnCoordinate
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging: itemIsDragging } = useSortable({
        id: 'start',
        disabled: isEditingStart
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: itemIsDragging ? 0.5 : 1,
        zIndex: itemIsDragging ? 1000 : 1
    };

    const isDropTarget = dragOverId === 'start' && isDragging;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 transition-all duration-200 ${isDropTarget ? 'bg-blue-50 border border-blue-300 rounded-lg shadow-md' : ''} ${itemIsDragging ? 'shadow-lg' : ''}`}
        >
            <button
                className={`p-1 cursor-grab active:cursor-grabbing rounded hover:bg-gray-100 transition-colors ${itemIsDragging ? 'bg-blue-100' : 'text-gray-400 hover:text-gray-600'}`}
                title="Kéo để sắp xếp"
                {...attributes}
                {...listeners}
            >
                <GripVertical size={16} />
            </button>
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center" title="Điểm đầu">
                1
            </div>
            <div className="relative flex-1">
                <input
                    className="w-full border rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Nhập địa chỉ hoặc Lat,Lng (ví dụ: 21.0278, 105.8342)"
                    value={startText}
                    onFocus={() => setIsEditingStart(true)}
                    onBlur={() => setIsEditingStart(false)}
                    onChange={(e) => {
                        const val = e.target.value;
                        setStartText(val);
                        const trimmed = val.trim();
                        startPendingQueryRef.current = trimmed;
                        if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
                        startTimerRef.current = window.setTimeout(async () => {
                            const query = startPendingQueryRef.current;
                            if (!query || query.length < 2) {
                                setStartSugs([]);
                                return;
                            }
                            const sugs = await geocodeSuggest(query);
                            if (startPendingQueryRef.current === query) setStartSugs(sugs);
                        }, SUGGEST_DEBOUNCE_MS);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onSearchStart();
                        }
                    }}
                />
                {startSugs.length > 0 && (
                    <div className="absolute top-full left-0 right-16 mt-1 bg-white border border-gray-200 rounded shadow-lg z-[500] max-h-56 overflow-auto">
                        {startSugs.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => {
                                    setStartPoint({ lat: s.center[1], lng: s.center[0] });
                                    setStartText(s.place_name);
                                    setIsEditingStart(false);
                                    setStartSugs([]);
                                }}
                            >
                                {s.place_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <button
                className="shrink-0 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs px-2.5 py-1.5 rounded flex items-center gap-1"
                onClick={() => {
                    setIsEditingStart(false);
                    onPickStart();
                }}
                title="Chọn trên bản đồ"
                disabled={loadingStart}
            >
                {loadingStart ? '…' : <MapPin size={14} />}
            </button>
            <button
                className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white text-xs px-2.5 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => { if (currentPoint) focusOnCoordinate(currentPoint); }}
                title="Phóng tới điểm bắt đầu"
                disabled={loadingStart || !currentPoint}
            >
                {loadingStart ? 'Đang tìm…' : 'Tìm'}
            </button>
        </div>
    );
});

SortableStartRow.displayName = 'SortableStartRow';

// Move SortableEndRow outside of ControlsPanel
const SortableEndRow: React.FC<{
    endText: string;
    setEndText: React.Dispatch<React.SetStateAction<string>>;
    setEndPoint: (p: { lat: number; lng: number } | null) => void;
    isEditingEnd: boolean;
    setIsEditingEnd: React.Dispatch<React.SetStateAction<boolean>>;
    loadingEnd: boolean;
    endSugs: Suggestion[];
    setEndSugs: React.Dispatch<React.SetStateAction<Suggestion[]>>;
    onPickEnd: () => void;
    onSearchEnd: () => void;
    dragOverId: string | null;
    isDragging: boolean;
    waypoints: Array<{ lat: number; lng: number }>;
    geocodeSuggest: (query: string) => Promise<Suggestion[]>;
    endTimerRef: React.MutableRefObject<number | null>;
    endPendingQueryRef: React.MutableRefObject<string>;
    currentPoint: { lat: number; lng: number } | null;
    focusOnCoordinate: (coords: { lat: number; lng: number }) => void;
}> = React.memo(({
    endText, setEndText, setEndPoint, isEditingEnd, setIsEditingEnd,
    loadingEnd, endSugs, setEndSugs, onPickEnd, onSearchEnd,
    dragOverId, isDragging, waypoints, geocodeSuggest, endTimerRef, endPendingQueryRef,
    currentPoint, focusOnCoordinate
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging: itemIsDragging } = useSortable({
        id: 'end',
        disabled: isEditingEnd
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: itemIsDragging ? 0.5 : 1,
        zIndex: itemIsDragging ? 1000 : 1
    };

    const isDropTarget = dragOverId === 'end' && isDragging;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 transition-all duration-200 ${isDropTarget ? 'bg-blue-50 border border-blue-300 rounded-lg shadow-md' : ''} ${itemIsDragging ? 'shadow-lg' : ''}`}
        >
            <button
                className={`p-1 cursor-grab active:cursor-grabbing rounded hover:bg-gray-100 transition-colors ${itemIsDragging ? 'bg-blue-100' : 'text-gray-400 hover:text-gray-600'}`}
                title="Kéo để sắp xếp"
                {...attributes}
                {...listeners}
            >
                <GripVertical size={16} />
            </button>
            <div className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center" title="Điểm cuối">
                {waypoints.length + 2}
            </div>
            <div className="relative flex-1">
                <input
                    className="w-full border rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Nhập địa chỉ hoặc Lat,Lng"
                    value={endText}
                    onFocus={() => setIsEditingEnd(true)}
                    onBlur={() => setIsEditingEnd(false)}
                    onChange={(e) => {
                        const val = e.target.value;
                        setEndText(val);
                        const trimmed = val.trim();
                        endPendingQueryRef.current = trimmed;
                        if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
                        endTimerRef.current = window.setTimeout(async () => {
                            const query = endPendingQueryRef.current;
                            if (!query || query.length < 2) {
                                setEndSugs([]);
                                return;
                            }
                            const sugs = await geocodeSuggest(query);
                            if (endPendingQueryRef.current === query) setEndSugs(sugs);
                        }, SUGGEST_DEBOUNCE_MS);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onSearchEnd();
                        }
                    }}
                />
                {endSugs.length > 0 && (
                    <div className="absolute top-full left-0 right-16 mt-1 bg-white border border-gray-200 rounded shadow-lg z-[500] max-h-56 overflow-auto">
                        {endSugs.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => {
                                    setEndPoint({ lat: s.center[1], lng: s.center[0] });
                                    setEndText(s.place_name);
                                    setIsEditingEnd(false);
                                    setEndSugs([]);
                                }}
                            >
                                {s.place_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <button
                className="shrink-0 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs px-2.5 py-1.5 rounded flex items-center gap-1"
                onClick={() => {
                    setIsEditingEnd(false);
                    onPickEnd();
                }}
                title="Chọn trên bản đồ"
                disabled={loadingEnd}
            >
                {loadingEnd ? '…' : <MapPin size={14} />}
            </button>
            <button
                className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white text-xs px-2.5 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => { if (currentPoint) focusOnCoordinate(currentPoint); }}
                title="Phóng tới điểm kết thúc"
                disabled={loadingEnd || !currentPoint}
            >
                {loadingEnd ? 'Đang tìm…' : 'Tìm'}
            </button>
        </div>
    );
});

SortableEndRow.displayName = 'SortableEndRow';

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
    profile, setProfile, isRouting, calculateRoute, instructions, routeSummary,
    activeStepIdx, focusStep, onStartGuidance,
    startPoint, endPoint, waypoints, startLabel, endLabel, waypointLabels, setWaypointLabels,
    setStartPoint, setEndPoint, setWaypoints,
    onPickStart, onPickEnd, onPickWaypoint, focusOnCoordinate,
}) => {
    // Local input texts for search boxes
    const [startText, setStartText] = useState<string>("");
    const [endText, setEndText] = useState<string>("");
    const [waypointTexts, setWaypointTexts] = useState<string[]>([]);
    // Stable ids for waypoints to avoid key/index issues when reordering
    const [waypointIds, setWaypointIds] = useState<string[]>([]);
    const wpIdCounter = useRef(0);
    // Editing guards to avoid overwriting while user is typing
    const [isEditingStart, setIsEditingStart] = useState<boolean>(false);
    const [isEditingEnd, setIsEditingEnd] = useState<boolean>(false);
    const [isEditingWaypoint, setIsEditingWaypoint] = useState<boolean[]>([]);
    // Loading flags for geocoding
    const [loadingStart, setLoadingStart] = useState<boolean>(false);
    const [loadingEnd, setLoadingEnd] = useState<boolean>(false);
    const [loadingWaypoint, setLoadingWaypoint] = useState<boolean[]>([]);
    // Suggestion lists
    const [startSugs, setStartSugs] = useState<Suggestion[]>([]);
    const [endSugs, setEndSugs] = useState<Suggestion[]>([]);
    const [waypointSugs, setWaypointSugs] = useState<Record<number, Suggestion[]>>({});
    // Enhanced drag state tracking
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    // Debounce timers
    const startTimerRef = useRef<number | null>(null);
    const endTimerRef = useRef<number | null>(null);
    const waypointTimerRef = useRef<Record<number, number>>({});
    const startPendingQueryRef = useRef<string>("");
    const endPendingQueryRef = useRef<string>("");
    const waypointPendingQueryRef = useRef<Record<number, string>>({});
    const prevWaypointLabelsRef = useRef<string[]>([]);

    useEffect(() => {
        return () => {
            if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
            if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
            Object.values(waypointTimerRef.current).forEach((id) => window.clearTimeout(id));
        };
    }, []);

    // Ensure waypointIds length tracks waypointTexts length and is stable
    useEffect(() => {
        setWaypointIds((prev) => {
            const needed = waypointTexts.length;
            const current = prev.length;

            if (needed === current) return prev;

            if (needed > current) {
                // Add new IDs
                const newIds = [...prev];
                for (let i = current; i < needed; i++) {
                    newIds.push(`wp-${++wpIdCounter.current}`);
                }
                return newIds;
            } else {
                // Remove excess IDs
                return prev.slice(0, needed);
            }
        });
    }, [waypointTexts.length]);

    // Initialize texts from coords when coming from map or first mount
    useEffect(() => {
        if (isEditingStart) return;
        if (startLabel && startLabel.trim() && startText !== startLabel) {
            setStartText(startLabel);
            return;
        }
        if (startPoint && !startText) {
            const coords = `${startPoint.lat.toFixed(6)}, ${startPoint.lng.toFixed(6)}`;
            if (startText !== coords) setStartText(coords);
        }
    }, [startPoint?.lat, startPoint?.lng, startLabel, isEditingStart, startText]);

    useEffect(() => {
        if (isEditingEnd) return;
        if (endLabel && endLabel.trim() && endText !== endLabel) {
            setEndText(endLabel);
            return;
        }
        if (endPoint && !endText) {
            const coords = `${endPoint.lat.toFixed(6)}, ${endPoint.lng.toFixed(6)}`;
            if (endText !== coords) setEndText(coords);
        }
    }, [endPoint?.lat, endPoint?.lng, endLabel, isEditingEnd, endText]);

    useEffect(() => {
        const previousLabels = prevWaypointLabelsRef.current;
        setWaypointTexts((prev) => {
            const next: string[] = new Array(waypoints.length).fill("");
            for (let i = 0; i < waypoints.length; i++) {
                const editing = isEditingWaypoint[i];
                const current = prev[i] ?? "";
                const label = waypointLabels?.[i]?.trim();
                const prevLabelRaw = previousLabels[i];
                const prevLabel = prevLabelRaw ? prevLabelRaw.trim() : "";
                const coords = waypoints[i];
                const fallback = coords ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : "";

                if (editing) {
                    next[i] = current;
                    continue;
                }

                if (label) {
                    const labelChanged = label !== prevLabel;
                    if (!current || current === fallback || (labelChanged && (!current || current === prevLabel))) {
                        next[i] = label;
                        continue;
                    }
                }

                if (!current) {
                    next[i] = fallback;
                } else {
                    next[i] = current;
                }
            }
            return next;
        });
        prevWaypointLabelsRef.current = (waypointLabels ?? []).slice();
    }, [waypoints, waypointLabels, isEditingWaypoint]);

    // keep editing and loading arrays sized to waypoint count
    useEffect(() => {
        setIsEditingWaypoint((prev) => {
            const next = prev.slice();
            next.length = waypoints.length;
            for (let i = 0; i < waypoints.length; i++) if (typeof next[i] !== 'boolean') next[i] = false;
            return next;
        });
        setLoadingWaypoint((prev) => {
            const next = prev.slice();
            next.length = waypoints.length;
            for (let i = 0; i < waypoints.length; i++) if (typeof next[i] !== 'boolean') next[i] = false;
            return next;
        });
    }, [waypoints.length]);

    const geocoder = useMemo(() => getGeocoder(), []);

    const parseLatLng = useCallback((text: string): { lat: number; lng: number } | null => {
        try {
            const parts = text.trim().split(/[\s,;]+/);
            if (parts.length !== 2) return null;
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
            return null;
        } catch { return null; }
    }, []);

    const geocodeForward = useCallback(async (query: string): Promise<{ lat: number; lng: number; place_name: string } | null> => {
        try {
            const top = await geocoder.geocode(query);
            if (!top) return null;
            return { lng: top.center[0], lat: top.center[1], place_name: top.place_name };
        } catch { return null; }
    }, [geocoder]);

    const geocodeSuggest = useCallback(async (query: string): Promise<Suggestion[]> => {
        const trimmed = query.trim();
        if (trimmed.length < 3) return [];
        try {
            return await geocoder.suggest(trimmed);
        } catch { return []; }
    }, [geocoder]);

    const handleSearchStart = useCallback(async () => {
        if (loadingStart) return;
        setLoadingStart(true);
        const parsed = parseLatLng(startText);
        if (parsed) {
            setStartPoint(parsed);
            setIsEditingStart(false);
            setLoadingStart(false);
            return;
        }
        const gc = await geocodeForward(startText);
        if (!gc) {
            alert('Không tìm thấy vị trí bắt đầu.');
            setLoadingStart(false);
            return;
        }
        setStartPoint({ lat: gc.lat, lng: gc.lng });
        setStartText(gc.place_name);
        setIsEditingStart(false);
        setLoadingStart(false);
    }, [startText, geocodeForward, setStartPoint, loadingStart, parseLatLng]);

    const handleSearchEnd = useCallback(async () => {
        if (loadingEnd) return;
        setLoadingEnd(true);
        const parsed = parseLatLng(endText);
        if (parsed) {
            setEndPoint(parsed);
            setIsEditingEnd(false);
            setLoadingEnd(false);
            return;
        }
        const gc = await geocodeForward(endText);
        if (!gc) {
            alert('Không tìm thấy vị trí kết thúc.');
            setLoadingEnd(false);
            return;
        }
        setEndPoint({ lat: gc.lat, lng: gc.lng });
        setEndText(gc.place_name);
        setIsEditingEnd(false);
        setLoadingEnd(false);
    }, [endText, geocodeForward, setEndPoint, loadingEnd, parseLatLng]);

    const handleSearchWaypoint = useCallback(async (idx: number) => {
        if (loadingWaypoint[idx]) return;
        setLoadingWaypoint(prev => prev.map((v, i) => i === idx ? true : (typeof v === 'boolean' ? v : false)));
        const text = waypointTexts[idx] || "";
        const parsed = parseLatLng(text);
        if (parsed) {
            const next = [...waypoints];
            next[idx] = parsed;
            setWaypoints(next);
            setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
            setLoadingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
            return;
        }
        const gc = await geocodeForward(text);
        if (!gc) {
            alert('Không tìm thấy điểm trung gian.');
            setLoadingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
            return;
        }
        const next = [...waypoints];
        next[idx] = { lat: gc.lat, lng: gc.lng };
        setWaypoints(next);
        setWaypointTexts(prev => prev.map((t, i) => i === idx ? gc.place_name : t));
        setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
        setLoadingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
    }, [waypointTexts, waypoints, setWaypoints, geocodeForward, loadingWaypoint, parseLatLng]);

    const handleAddWaypoint = useCallback(() => {
        setWaypointTexts(prev => [...prev, ""]);
        // Do not change waypoints until user searches/sets it
    }, []);

    const handleRemoveWaypoint = useCallback((idx: number) => {
        setWaypointTexts(prev => prev.filter((_, i) => i !== idx));
        // Use current waypoints array (from props) to avoid implicit any in functional setter
        setWaypoints(waypoints.filter((_, i) => i !== idx));
        setWaypointIds(prev => prev.filter((_, i) => i !== idx));

        // Clean up related states
        setIsEditingWaypoint(prev => prev.filter((_, i) => i !== idx));
        setLoadingWaypoint(prev => prev.filter((_, i) => i !== idx));
        setWaypointSugs(prev => {
            const newSugs = { ...prev } as Record<number, Suggestion[]>;
            delete newSugs[idx];
            // Shift down the indices
            const shifted: Record<number, Suggestion[]> = {};
            Object.keys(newSugs).forEach((key) => {
                const numKey = parseInt(key);
                if (numKey > idx) {
                    shifted[numKey - 1] = newSugs[numKey];
                } else if (numKey < idx) {
                    shifted[numKey] = newSugs[numKey];
                }
            });
            return shifted;
        });
        const pending = { ...waypointPendingQueryRef.current };
        delete pending[idx];
        const shiftedPending: Record<number, string> = {};
        Object.keys(pending).forEach((key) => {
            const numKey = parseInt(key, 10);
            if (numKey > idx) shiftedPending[numKey - 1] = pending[numKey];
            else if (numKey < idx) shiftedPending[numKey] = pending[numKey];
        });
        waypointPendingQueryRef.current = shiftedPending;
    }, [setWaypoints, waypoints]);

    const handleChangeWaypointText = useCallback((idx: number, val: string) => {
        setWaypointTexts(prev => prev.map((t, i) => i === idx ? val : t));
    }, []);

    const handleDragStart = useCallback(() => {
        setIsDragging(true);
    }, []);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { over } = event;
        setDragOverId(over ? String(over.id) : null);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setIsDragging(false);
        setDragOverId(null);
        if (!over || active.id === over.id) return;

        const items = ['start', ...waypointIds, 'end'];
        const activeId = String(active.id);
        const overId = String(over.id);
        const oldIndex = items.indexOf(activeId);
        const newIndex = items.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return;

        // Create a full dataset before reordering
        const fullDataSet = [
            { id: 'start', point: startPoint, text: startText },
            ...waypointIds.map((id, i) => ({ id, point: waypoints[i], text: waypointTexts[i] })),
            { id: 'end', point: endPoint, text: endText },
        ];

        // Reorder the full dataset
        const [movedItem] = fullDataSet.splice(oldIndex, 1);
        fullDataSet.splice(newIndex, 0, movedItem);

        // Extract new start, end, and waypoints from the reordered dataset
        const newStart = fullDataSet[0];
        const newEnd = fullDataSet[fullDataSet.length - 1];
        const newWaypointsData = fullDataSet.slice(1, -1);

        const newWaypointIds = newWaypointsData.map(d => (d.id === 'start' || d.id === 'end') ? `wp-${++wpIdCounter.current}` : d.id);
        const newWaypointPoints = newWaypointsData.map(d => d.point).filter(p => p) as Array<{ lat: number; lng: number }>;
        const newWaypointTexts = newWaypointsData.map(d => d.text || '');

        // Apply new state
        setStartPoint(newStart.point || null);
        setStartText(newStart.text || '');
        setEndPoint(newEnd.point || null);
        setEndText(newEnd.text || '');
        setWaypoints(newWaypointPoints);
        setWaypointTexts(newWaypointTexts);
        setWaypointIds(newWaypointIds);
        setWaypointLabels(newWaypointTexts);

        // Clear transient UI state
        setWaypointSugs({});
        setIsEditingWaypoint(prev => prev.map(() => false));
        setIsEditingStart(false);
        setIsEditingEnd(false);
        setStartSugs([]);
        setEndSugs([]);
    }, [startPoint, endPoint, startText, endText, waypointIds, waypointTexts, waypoints, setStartPoint, setEndPoint, setWaypoints, setWaypointLabels]);

    // Swap start/end and reverse waypoints order
    const handleReverseRoute = useCallback(() => {
        // Points
        const newStart = endPoint ? { ...endPoint } : null;
        const newEnd = startPoint ? { ...startPoint } : null;
        const newWaypoints = [...waypoints].reverse();

        setStartPoint(newStart);
        setEndPoint(newEnd);
        setWaypoints(newWaypoints);

        // Texts
        setStartText(endText);
        setEndText(startText);
        setWaypointTexts((prev) => [...prev].reverse());
        // Keep waypoint id order in sync with texts after reverse
        setWaypointIds((prev) => [...prev].reverse());

        // Reset editing/suggestions for clarity
        setIsEditingStart(false);
        setIsEditingEnd(false);
        setIsEditingWaypoint((prev) => prev.map(() => false));
        setStartSugs([]);
        setEndSugs([]);
        setWaypointSugs({});
    }, [startPoint, endPoint, waypoints, startText, endText, setStartPoint, setEndPoint, setWaypoints]);

    return (
        <div className="absolute top-30 left-3 z-[360] bg-white/95 backdrop-blur rounded-lg shadow border border-gray-200 p-3 w-[380px]">
            {/* Start/End/Waypoints section */}
            <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold">Điểm đi/đến</div>
                    <div className="flex items-center gap-3">
                        <button
                            className="text-xs text-gray-700 hover:underline flex items-center gap-1"
                            title="Đảo chiều đi/đến"
                            onClick={handleReverseRoute}
                        >
                            <ArrowUpDown size={12} /> Đảo chiều
                        </button>
                        <button
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            title="Thêm điểm trung gian"
                            onClick={handleAddWaypoint}
                        >
                            <Plus size={12} /> Thêm điểm đến
                        </button>
                    </div>
                </div>
                <div className="space-y-2">
                    <DndContext
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={['start', ...waypointIds, 'end']} strategy={verticalListSortingStrategy}>
                            <SortableStartRow
                                startText={startText}
                                setStartText={setStartText}
                                setStartPoint={setStartPoint}
                                isEditingStart={isEditingStart}
                                setIsEditingStart={setIsEditingStart}
                                loadingStart={loadingStart}
                                startSugs={startSugs}
                                setStartSugs={setStartSugs}
                                onPickStart={onPickStart}
                                onSearchStart={handleSearchStart}
                                dragOverId={dragOverId}
                                isDragging={isDragging}
                                geocodeSuggest={geocodeSuggest}
                                startTimerRef={startTimerRef}
                                startPendingQueryRef={startPendingQueryRef}
                                currentPoint={startPoint}
                                focusOnCoordinate={focusOnCoordinate}
                            />
                            {waypointIds.map((id, idx) => (
                                <SortableWaypoint
                                    key={id}
                                    idStr={id}
                                    idx={idx}
                                    txt={waypointTexts[idx] || ''}
                                    waypoints={waypoints}
                                    setWaypoints={setWaypoints}
                                    waypointTexts={waypointTexts}
                                    setWaypointTexts={setWaypointTexts}
                                    isEditingWaypoint={isEditingWaypoint}
                                    setIsEditingWaypoint={setIsEditingWaypoint}
                                    loadingWaypoint={loadingWaypoint}
                                    setLoadingWaypoint={setLoadingWaypoint}
                                    waypointSugs={waypointSugs}
                                    setWaypointSugs={setWaypointSugs}
                                    onPickWaypoint={onPickWaypoint}
                                    onRemoveWaypoint={handleRemoveWaypoint}
                                    onSearchWaypoint={handleSearchWaypoint}
                                    onChangeWaypointText={handleChangeWaypointText}
                                    dragOverId={dragOverId}
                                    isDragging={isDragging}
                                    geocodeSuggest={geocodeSuggest}
                                    waypointTimerRef={waypointTimerRef}
                                    waypointPendingQueryRef={waypointPendingQueryRef}
                                    focusOnCoordinate={focusOnCoordinate}
                                />
                            ))}
                            <SortableEndRow
                                endText={endText}
                                setEndText={setEndText}
                                setEndPoint={setEndPoint}
                                isEditingEnd={isEditingEnd}
                                setIsEditingEnd={setIsEditingEnd}
                                loadingEnd={loadingEnd}
                                endSugs={endSugs}
                                setEndSugs={setEndSugs}
                                onPickEnd={onPickEnd}
                                onSearchEnd={handleSearchEnd}
                                dragOverId={dragOverId}
                                isDragging={isDragging}
                                waypoints={waypoints}
                                geocodeSuggest={geocodeSuggest}
                                endTimerRef={endTimerRef}
                                endPendingQueryRef={endPendingQueryRef}
                                currentPoint={endPoint}
                                focusOnCoordinate={focusOnCoordinate}
                            />
                        </SortableContext>
                    </DndContext>
                </div>
            </div>

            {/* Profile and route calculation section */}
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-semibold">Routing</div>
                <div className="flex items-center gap-2">
                    <label className="text-xs">Profile</label>
                    <select
                        className="text-xs border rounded px-2 py-1"
                        value={profile}
                        onChange={(e) => setProfile(e.target.value as Profile)}
                    >
                        <option value="driving">Driving</option>
                        <option value="walking">Walking</option>
                        <option value="cycling">Cycling</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
                <button
                    onClick={calculateRoute}
                    disabled={isRouting}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded"
                >
                    {isRouting ? 'Calculating…' : 'Calculate Route'}
                </button>
                <button
                    onClick={onStartGuidance}
                    disabled={!instructions || instructions.length === 0}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded"
                    title="Bắt đầu chỉ đường"
                >
                    Chỉ đường
                </button>
                {routeSummary && (
                    <div className="flex items-center gap-3 text-xs">
                        <div className="bg-blue-50 border-l-4 border-blue-400 px-2 py-1 rounded">
                            <div className="text-blue-700 font-semibold">{routeSummary.distanceKm.toFixed(1)} km</div>
                            <div className="text-gray-600 text-[10px]">Distance</div>
                        </div>
                        <div className="bg-green-50 border-l-4 border-green-400 px-2 py-1 rounded">
                            <div className="text-green-700 font-semibold">{formatDuration(routeSummary.durationMin)}</div>
                            <div className="text-gray-600 text-[10px]">Duration</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Directions section */}
            <div className="max-h-64 overflow-auto">
                <h3 className="text-xs font-semibold text-gray-700 mb-2">Directions</h3>
                {(!instructions || instructions.length === 0) ? (
                    <div className="text-[11px] text-gray-500">No instructions yet. Click "Calculate Route".</div>
                ) : (
                    <ol className="space-y-2">
                        {instructions.map((step: any, index: number) => (
                            <li
                                key={index}
                                className={`rounded border p-2 text-xs cursor-pointer transition-colors ${activeStepIdx === index ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                                    }`}
                                onClick={() => focusStep(index)}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2">
                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold ${activeStepIdx === index ? 'bg-blue-200 text-blue-900' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {index + 1}
                                        </span>
                                        <div>
                                            <div className="font-medium text-gray-800">{formatInstructionVI(step)}</div>
                                            {!!step?.name && <div className="text-[10px] text-gray-500">{step.name}</div>}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-gray-600 whitespace-nowrap">
                                        {formatDistance(step?.distance || 0)}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );
};