"use client";
import React from 'react';
import { formatDistance, formatInstructionVI } from './formatters';

type Props = {
    visible: boolean;
    headingDeg: number;
    instructions: any[];
    activeStepIdx: number | null;
    onPrev: () => void;
    onNext: () => void;
    onStop: () => void;
};

export const GuidanceHUD: React.FC<Props> = ({ visible, headingDeg, instructions, activeStepIdx, onPrev, onNext, onStop }) => {
    if (!visible || activeStepIdx == null) return null;
    return (
        <div className="absolute left-1/2 -translate-x-1/2 top-4 z-[400] bg-white/95 backdrop-blur px-4 py-3 rounded-lg shadow-lg border border-gray-200 w-[360px]">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2 L15 10 L12 8 L9 10 Z" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-gray-800">{formatInstructionVI(instructions[activeStepIdx])}</div>
                        <div className="text-xs text-gray-500">Bước {activeStepIdx + 1} / {instructions.length} • {formatDistance(instructions[activeStepIdx]?.distance || 0)}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onPrev} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200">Trước</button>
                    <button onClick={onNext} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200">Tiếp</button>
                    <button onClick={onStop} className="px-2 py-1 text-xs rounded bg-red-100 hover:bg-red-200 text-red-700">Dừng</button>
                </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" width="18" height="18" style={{ transform: `rotate(${headingDeg}deg)`, transition: 'transform 0.2s ease' }} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2 L15 10 L12 8 L9 10 Z" />
                    </svg>
                </div>
                <div className="text-xs text-gray-600">Hướng: {Math.round(headingDeg)}°</div>
            </div>
        </div>
    );
};
