"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDuration, formatDistance, formatInstructionVI } from './formatters';
import config from '@/config/config';
import { getGeocoder, type Suggestion } from '@/services/geocoding';

type Profile = 'driving' | 'walking' | 'cycling';

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
    // New props for selecting start/end/waypoints
    startPoint: { lat: number; lng: number } | null;
    endPoint: { lat: number; lng: number } | null;
    waypoints: Array<{ lat: number; lng: number }>;
    startLabel?: string;
    endLabel?: string;
    waypointLabels?: string[];
    setStartPoint: (p: { lat: number; lng: number } | null) => void;
    setEndPoint: (p: { lat: number; lng: number } | null) => void;
    setWaypoints: (wps: Array<{ lat: number; lng: number }>) => void;
    // Triggers to pick a point on the map
    onPickStart: () => void;
    onPickEnd: () => void;
    onPickWaypoint: (index: number) => void;
};

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
    profile, setProfile, isRouting, calculateRoute, instructions, routeSummary,
    activeStepIdx, focusStep, onStartGuidance,
    startPoint, endPoint, waypoints, startLabel, endLabel, waypointLabels, setStartPoint, setEndPoint, setWaypoints,
    onPickStart, onPickEnd, onPickWaypoint,
}) => {
    // Local input texts for search boxes
    const [startText, setStartText] = useState<string>("");
    const [endText, setEndText] = useState<string>("");
    const [waypointTexts, setWaypointTexts] = useState<string[]>([]);
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
    // Debounce timers
    const startTimerRef = useRef<number | null>(null);
    const endTimerRef = useRef<number | null>(null);
    const waypointTimerRef = useRef<Record<number, number>>({});

    // Initialize texts from coords when coming from map or first mount
    useEffect(() => {
        if (isEditingStart) return;
        if (startLabel && startLabel.trim()) {
            setStartText(startLabel);
            return;
        }
        if (startPoint) setStartText(`${startPoint.lat.toFixed(6)}, ${startPoint.lng.toFixed(6)}`);
    }, [startPoint?.lat, startPoint?.lng, startLabel, isEditingStart]);
    useEffect(() => {
        if (isEditingEnd) return; // separate input, but keep symmetry
        if (startLabel && startLabel.trim()) setStartText(startLabel);
    }, [startLabel, isEditingEnd]);
    useEffect(() => {
        if (isEditingEnd) return;
        if (endLabel && endLabel.trim()) {
            setEndText(endLabel);
            return;
        }
        if (endPoint) setEndText(`${endPoint.lat.toFixed(6)}, ${endPoint.lng.toFixed(6)}`);
    }, [endPoint?.lat, endPoint?.lng, endLabel, isEditingEnd]);
    useEffect(() => {
        if (isEditingStart) return; // separate input
        if (endLabel && endLabel.trim()) setEndText(endLabel);
    }, [endLabel, isEditingStart]);
    useEffect(() => {
        setWaypointTexts((prev) => {
            const next: string[] = [];
            for (let i = 0; i < waypoints.length; i++) {
                const label = waypointLabels?.[i];
                const editing = isEditingWaypoint[i];
                if (!editing && label && label.trim()) next[i] = label;
                else if (!editing && waypoints[i]) next[i] = `${waypoints[i].lat.toFixed(6)}, ${waypoints[i].lng.toFixed(6)}`;
                else next[i] = prev[i] ?? "";
            }
            return next;
        });
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

    const parseLatLng = (text: string): { lat: number; lng: number } | null => {
        try {
            const parts = text.trim().split(/[\s,;]+/);
            if (parts.length !== 2) return null;
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
            return null;
        } catch { return null; }
    };

    const geocodeForward = useCallback(async (query: string): Promise<{ lat: number; lng: number; place_name: string } | null> => {
        try {
            const top = await geocoder.geocode(query);
            if (!top) return null;
            return { lng: top.center[0], lat: top.center[1], place_name: top.place_name };
        } catch { return null; }
    }, [geocoder]);

    const geocodeSuggest = useCallback(async (query: string): Promise<Suggestion[]> => {
        try {
            return await geocoder.suggest(query);
        } catch { return []; }
    }, [geocoder]);

    const handleSearchStart = useCallback(async () => {
        if (loadingStart) return;
        setLoadingStart(true);
        const parsed = parseLatLng(startText);
        if (parsed) { setStartPoint(parsed); setIsEditingStart(false); setLoadingStart(false); return; }
        const gc = await geocodeForward(startText);
        if (!gc) { alert('Không tìm thấy vị trí bắt đầu.'); setLoadingStart(false); return; }
        setStartPoint({ lat: gc.lat, lng: gc.lng });
        setStartText(gc.place_name);
        setIsEditingStart(false);
        setLoadingStart(false);
    }, [startText, geocodeForward, setStartPoint, loadingStart]);

    const handleSearchEnd = useCallback(async () => {
        if (loadingEnd) return;
        setLoadingEnd(true);
        const parsed = parseLatLng(endText);
        if (parsed) { setEndPoint(parsed); setIsEditingEnd(false); setLoadingEnd(false); return; }
        const gc = await geocodeForward(endText);
        if (!gc) { alert('Không tìm thấy vị trí kết thúc.'); setLoadingEnd(false); return; }
        setEndPoint({ lat: gc.lat, lng: gc.lng });
        setEndText(gc.place_name);
        setIsEditingEnd(false);
        setLoadingEnd(false);
    }, [endText, geocodeForward, setEndPoint, loadingEnd]);

    const handleAddWaypoint = useCallback(() => {
        setWaypointTexts(prev => [...prev, ""]);
        // Do not change waypoints until user searches/sets it
    }, []);

    const handleRemoveWaypoint = useCallback((idx: number) => {
        setWaypointTexts(prev => prev.filter((_, i) => i !== idx));
        setWaypoints(waypoints.filter((_, i) => i !== idx));
    }, [setWaypoints, waypoints]);

    const handleChangeWaypointText = useCallback((idx: number, val: string) => {
        setWaypointTexts(prev => prev.map((t, i) => i === idx ? val : t));
    }, []);

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
        if (!gc) { alert('Không tìm thấy điểm trung gian.'); setLoadingWaypoint(prev => prev.map((v, i) => i === idx ? false : v)); return; }
        const next = [...waypoints];
        next[idx] = { lat: gc.lat, lng: gc.lng };
        setWaypoints(next);
        setWaypointTexts(prev => prev.map((t, i) => i === idx ? gc.place_name : t));
        setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
        setLoadingWaypoint(prev => prev.map((v, i) => i === idx ? false : v));
    }, [waypointTexts, waypoints, setWaypoints, geocodeForward, loadingWaypoint]);
    return (
        <div className="absolute top-30 left-3 z-[360] bg-white/95 backdrop-blur rounded-lg shadow border border-gray-200 p-3 w-[380px]">
            {/* Start/End/Waypoints section */}
            <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold">Điểm đi/đến</div>
                    <button
                        className="text-xs text-blue-600 hover:underline"
                        title="Thêm điểm trung gian"
                        onClick={handleAddWaypoint}
                    >+ Thêm điểm đến</button>
                </div>
                <div className="space-y-2">
                    {/* Start */}
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-blue-600" title="Điểm đầu" />
                        <input
                            className="flex-1 border rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="Nhập địa chỉ hoặc Lat,Lng (ví dụ: 21.0278, 105.8342)"
                            value={startText}
                            onFocus={() => setIsEditingStart(true)}
                            onBlur={() => {/* keep text; only clear editing on search */ }}
                            onChange={(e) => {
                                const val = e.target.value;
                                setStartText(val);
                                if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
                                startTimerRef.current = window.setTimeout(async () => {
                                    if (val.trim().length < 2) { setStartSugs([]); return; }
                                    const sugs = await geocodeSuggest(val);
                                    setStartSugs(sugs);
                                }, 300);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSearchStart(); } }}
                        />
                        {/* Start suggestions */}
                        {startSugs.length > 0 && (
                            <div className="absolute mt-24 left-0 w-[calc(100%-100px)] bg-white border border-gray-200 rounded shadow z-[400] max-h-56 overflow-auto">
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
                                    >{s.place_name}</button>
                                ))}
                            </div>
                        )}
                        <button
                            className="shrink-0 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs px-2.5 py-1.5 rounded"
                            onClick={() => { setIsEditingStart(false); onPickStart(); }}
                            title="Chọn trên bản đồ"
                            disabled={loadingStart}
                        >{loadingStart ? '…' : '📍'}</button>
                        <button
                            className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white text-xs px-2.5 py-1.5 rounded"
                            onClick={handleSearchStart}
                            title="Tìm điểm đầu"
                            disabled={loadingStart}
                        >{loadingStart ? 'Đang tìm…' : 'Tìm'}</button>
                    </div>
                    {/* Waypoints */}
                    {waypointTexts.map((txt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border-2 border-gray-400" title={`Trung gian ${idx + 1}`} />
                            <input
                                className="flex-1 border rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                                placeholder="Điểm trung gian hoặc Lat,Lng"
                                value={txt}
                                onFocus={() => setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? true : v))}
                                onBlur={() => {/* keep text; only clear editing on search */ }}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    handleChangeWaypointText(idx, val);
                                    const prev = waypointTimerRef.current[idx];
                                    if (prev) window.clearTimeout(prev);
                                    waypointTimerRef.current[idx] = window.setTimeout(async () => {
                                        if (val.trim().length < 2) {
                                            setWaypointSugs((m) => ({ ...m, [idx]: [] }));
                                            return;
                                        }
                                        const sugs = await geocodeSuggest(val);
                                        setWaypointSugs((m) => ({ ...m, [idx]: sugs }));
                                    }, 300);
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSearchWaypoint(idx); } }}
                            />
                            {/* Waypoint suggestions */}
                            {(waypointSugs[idx]?.length || 0) > 0 && (
                                <div className="absolute mt-24 left-0 w-[calc(100%-140px)] bg-white border border-gray-200 rounded shadow z-[400] max-h-56 overflow-auto">
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
                                        >{s.place_name}</button>
                                    ))}
                                </div>
                            )}
                            <button
                                className="shrink-0 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs px-2.5 py-1.5 rounded"
                                onClick={() => { setIsEditingWaypoint(prev => prev.map((v, i) => i === idx ? false : v)); onPickWaypoint(idx); }}
                                title="Chọn trên bản đồ"
                                disabled={loadingWaypoint[idx]}
                            >{loadingWaypoint[idx] ? '…' : '📍'}</button>
                            <button
                                className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white text-xs px-2.5 py-1.5 rounded"
                                onClick={() => handleSearchWaypoint(idx)}
                                title="Tìm điểm trung gian"
                                disabled={loadingWaypoint[idx]}
                            >{loadingWaypoint[idx] ? 'Đang tìm…' : 'Tìm'}</button>
                            <button
                                className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs px-2.5 py-1.5 rounded"
                                onClick={() => handleRemoveWaypoint(idx)}
                                title="Xóa điểm này"
                            >X</button>
                        </div>
                    ))}
                    {/* End */}
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-red-600" title="Điểm cuối" />
                        <input
                            className="flex-1 border rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="Nhập địa chỉ hoặc Lat,Lng"
                            value={endText}
                            onFocus={() => setIsEditingEnd(true)}
                            onBlur={() => {/* keep text; only clear editing on search */ }}
                            onChange={(e) => {
                                const val = e.target.value;
                                setEndText(val);
                                if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
                                endTimerRef.current = window.setTimeout(async () => {
                                    if (val.trim().length < 2) { setEndSugs([]); return; }
                                    const sugs = await geocodeSuggest(val);
                                    setEndSugs(sugs);
                                }, 300);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSearchEnd(); } }}
                        />
                        {/* End suggestions */}
                        {endSugs.length > 0 && (
                            <div className="absolute mt-24 left-0 w-[calc(100%-100px)] bg-white border border-gray-200 rounded shadow z-[400] max-h-56 overflow-auto">
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
                                    >{s.place_name}</button>
                                ))}
                            </div>
                        )}
                        <button
                            className="shrink-0 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs px-2.5 py-1.5 rounded"
                            onClick={() => { setIsEditingEnd(false); onPickEnd(); }}
                            title="Chọn trên bản đồ"
                            disabled={loadingEnd}
                        >{loadingEnd ? '…' : '📍'}</button>
                        <button
                            className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white text-xs px-2.5 py-1.5 rounded"
                            onClick={handleSearchEnd}
                            title="Tìm điểm cuối"
                            disabled={loadingEnd}
                        >{loadingEnd ? 'Đang tìm…' : 'Tìm'}</button>
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-semibold">Routing</div>
                <div className="flex items-center gap-2">
                    <label className="text-xs">Profile</label>
                    <select className="text-xs border rounded px-2 py-1" value={profile} onChange={(e) => setProfile(e.target.value as Profile)}>
                        <option value="driving">Driving</option>
                        <option value="walking">Walking</option>
                        <option value="cycling">Cycling</option>
                    </select>
                </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
                <button onClick={calculateRoute} disabled={isRouting} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded">
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
            <div className="max-h-64 overflow-auto">
                <h3 className="text-xs font-semibold text-gray-700 mb-2">Directions</h3>
                {(!instructions || instructions.length === 0) ? (
                    <div className="text-[11px] text-gray-500">No instructions yet. Click "Calculate Route".</div>
                ) : (
                    <ol className="space-y-2">
                        {instructions.map((step: any, index: number) => (
                            <li key={index} className={`rounded border p-2 text-xs cursor-pointer transition-colors ${activeStepIdx === index ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`} onClick={() => focusStep(index)}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2">
                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold ${activeStepIdx === index ? 'bg-blue-200 text-blue-900' : 'bg-gray-100 text-gray-700'}`}>{index + 1}</span>
                                        <div>
                                            <div className="font-medium text-gray-800">{formatInstructionVI(step)}</div>
                                            {!!step?.name && <div className="text-[10px] text-gray-500">{step.name}</div>}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-gray-600 whitespace-nowrap">{formatDistance(step?.distance || 0)}</div>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );
};
