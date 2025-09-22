"use client";
import React from 'react';
import { formatDuration, formatDistance, formatInstructionVI } from './formatters';

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
};

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
    profile, setProfile, isRouting, calculateRoute, instructions, routeSummary,
    activeStepIdx, focusStep, onStartGuidance
}) => {
    return (
        <div className="absolute top-30 left-3 z-[360] bg-white/95 backdrop-blur rounded-lg shadow border border-gray-200 p-3 w-[360px]">
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
