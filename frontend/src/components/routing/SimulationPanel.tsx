"use client";
import React from 'react';

type SimulationPanelProps = {
    simPlaying: boolean;
    setSimPlaying: (v: boolean) => void;
    simSpeed: number;
    setSimSpeed: (v: number) => void;
    simFollow: boolean;
    setSimFollow: (v: boolean) => void;
    canSimulate: boolean;
    onSimReset: () => void;
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
}) => {
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
        </div>
    );
};
