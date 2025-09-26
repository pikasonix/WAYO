"use client";
import React from 'react';
import { formatDistance } from './formatters';

type SimulationPanelProps = {
    simPlaying: boolean;
    setSimPlaying: (v: boolean) => void;
    simSpeed: number;
    setSimSpeed: (v: number) => void;
    simFollow: boolean;
    setSimFollow: (v: boolean) => void;
    canSimulate: boolean;
    onSimReset: () => void;
    // Metrics
    simRemainingM?: number; // distance to destination in meters
    simEtaSec?: number; // estimated seconds to destination
    simToNextManeuverM?: number; // distance to next maneuver in meters
};

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
    simPlaying,
    setSimPlaying,
    simSpeed,
    setSimSpeed,
    simFollow,
    setSimFollow,
    canSimulate,
    onSimReset,
    simRemainingM = 0,
    simEtaSec = 0,
    simToNextManeuverM = 0,
}) => {
    const formatEta = (sec: number) => {
        if (!Number.isFinite(sec) || sec <= 0) return '—';
        const minutes = Math.round(sec / 60);
        if (minutes < 60) return `${minutes}m`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${m}m`;
    };
    return (
        <div className="absolute top-[120px] right-12 z-[360] bg-white/95 backdrop-blur rounded-lg shadow border border-gray-200 p-3 w-[360px]">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-semibold">Simulation</div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setSimPlaying(!simPlaying)}
                    disabled={!canSimulate}
                    className={`px-3 py-1.5 text-xs rounded ${simPlaying ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'} disabled:opacity-50`}
                    title="Bắt đầu/Tạm dừng giả lập di chuyển"
                >
                    {simPlaying ? 'Tạm dừng' : 'Giả lập'}
                </button>
                <label className="text-xs text-gray-600">Tốc độ</label>
                <select
                    value={simSpeed}
                    onChange={(e) => setSimSpeed(parseFloat(e.target.value))}
                    disabled={!canSimulate}
                    className="text-xs border rounded px-2 py-1 disabled:opacity-50"
                    title="Tốc độ giả lập"
                >
                    <option value={0.5}>0.5x</option>
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                </select>
                <button
                    onClick={() => setSimFollow(!simFollow)}
                    disabled={!canSimulate}
                    className={`px-2 py-1 text-xs rounded ${simFollow ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'} disabled:opacity-50`}
                    title="Theo dõi camera theo phương tiện"
                >
                    {simFollow ? 'Theo dõi' : 'Không theo dõi'}
                </button>
                <button
                    onClick={onSimReset}
                    disabled={!canSimulate}
                    className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-50"
                    title="Về đầu tuyến"
                >
                    Đầu tuyến
                </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-blue-50 border border-blue-200 rounded p-2">
                    <div className="text-[11px] text-blue-700 font-semibold">Còn lại</div>
                    <div className="text-xs text-blue-900">{formatDistance(simRemainingM || 0)}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
                    <div className="text-[11px] text-emerald-700 font-semibold">ETA</div>
                    <div className="text-xs text-emerald-900">{formatEta(simEtaSec || 0)}</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded p-2">
                    <div className="text-[11px] text-amber-700 font-semibold">Đến rẽ tiếp</div>
                    <div className="text-xs text-amber-900">{formatDistance(simToNextManeuverM || 0)}</div>
                </div>
            </div>
        </div>
    );
};
