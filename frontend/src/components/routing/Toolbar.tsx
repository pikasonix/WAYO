"use client";
import React from 'react';

type ToolbarProps = {
    is3D: boolean;
    angled: boolean;
    courseUp: boolean;
    keepZoom: boolean;
    smoothTurns: boolean;
    alwaysShowPopup: boolean;
    showAllPopups: boolean;
    onToggle3D: () => void;
    onToggleAngle: () => void;
    onToggleCourseUp: () => void;
    onToggleKeepZoom: () => void;
    onToggleSmoothTurns: () => void;
    onToggleAlwaysShowPopup: () => void;
    onToggleShowAllPopups: () => void;
    onRotateLeft: () => void;
    onRotateRight: () => void;
    onResetNorth: () => void;
    onPinMyLocation: () => void;
    onPinStep: () => void;
};

export const Toolbar: React.FC<ToolbarProps> = ({
    is3D, angled, courseUp, keepZoom, smoothTurns, alwaysShowPopup, showAllPopups,
    onToggle3D, onToggleAngle, onToggleCourseUp, onToggleKeepZoom, onToggleSmoothTurns,
    onToggleAlwaysShowPopup, onToggleShowAllPopups, onRotateLeft, onRotateRight, onResetNorth,
    onPinMyLocation, onPinStep
}) => {
    return (
        <div className="p-3 border-b text-sm bg-white flex items-center gap-3">
            <b>Mapbox</b>
            <button onClick={onToggle3D} className="ml-auto inline-flex items-center rounded bg-blue-600 text-white px-3 py-1 text-xs hover:bg-blue-700" title="Bật/tắt chế độ 3D (địa hình + tòa nhà)">{is3D ? "Tắt 3D" : "Bật 3D"}</button>
            <button onClick={onToggleAngle} className="inline-flex items-center rounded bg-slate-700 text-white px-3 py-1 text-xs hover:bg-slate-800" title="Chuyển đổi góc nhìn (nghiêng 3D ↔ nhìn từ trên xuống)">{angled ? "Nhìn từ trên xuống" : "Góc nhìn 3D"}</button>
            <div className="ml-2 flex items-center gap-2">
                <button onClick={onToggleCourseUp} className={`inline-flex items-center rounded ${courseUp ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} px-2 py-1 text-xs`} title="Khóa hướng theo tuyến (course-up)">{courseUp ? 'Mở khóa hướng' : 'Khóa hướng'}</button>
                <button onClick={onToggleKeepZoom} className={`inline-flex items-center rounded ${keepZoom ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} px-2 py-1 text-xs`} title="Giữ nguyên mức zoom khi căn khung">{keepZoom ? 'Giữ Zoom' : 'Auto Zoom'}</button>
                <button onClick={onToggleSmoothTurns} className={`inline-flex items-center rounded ${smoothTurns ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} px-2 py-1 text-xs`} title="Làm mượt góc khi rẽ (giới hạn tốc độ quay camera)">{smoothTurns ? 'Mượt góc rẽ' : 'Góc tức thời'}</button>
                <button onClick={onToggleAlwaysShowPopup} className={`inline-flex items-center rounded ${alwaysShowPopup ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} px-2 py-1 text-xs`} title="Luôn hiện thông báo ở bước hiện tại">{alwaysShowPopup ? 'Luôn hiện thông báo' : 'Ẩn khi không chọn'}</button>
                <button onClick={onToggleShowAllPopups} className={`inline-flex items-center rounded ${showAllPopups ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} px-2 py-1 text-xs`} title="Hiển thị popup cho TẤT CẢ marker">{showAllPopups ? 'Hiện tất cả Popup' : 'Chỉ hiện 1 Popup'}</button>
                <button onClick={onRotateLeft} className="inline-flex items-center rounded bg-gray-200 text-gray-800 px-2 py-1 text-xs hover:bg-gray-300" title="Xoay trái 10° (Q)">⟲</button>
                <button onClick={onRotateRight} className="inline-flex items-center rounded bg-gray-200 text-gray-800 px-2 py-1 text-xs hover:bg-gray-300" title="Xoay phải 10° (E)">⟳</button>
                <button onClick={onResetNorth} className="inline-flex items-center rounded bg-gray-200 text-gray-800 px-2 py-1 text-xs hover:bg-gray-300" title="Về hướng Bắc (R)">Bắc</button>
                <button onClick={onPinMyLocation} className="inline-flex items-center rounded bg-emerald-600 text-white px-2 py-1 text-xs hover:bg-emerald-700" title="Đặt pin tại vị trí hiện tại và phóng to">Vị trí tôi</button>
                <button onClick={onPinStep} className="inline-flex items-center rounded bg-blue-600 text-white px-2 py-1 text-xs hover:bg-blue-700" title="Đặt pin tại điểm thuộc tuyến và phóng to">Pin bước</button>
            </div>
        </div>
    );
};
