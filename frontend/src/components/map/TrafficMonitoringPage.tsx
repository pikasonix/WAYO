import React from 'react';

interface TrafficMonitoringPageProps {
    onBack: () => void;
}

const TrafficMonitoringPage: React.FC<TrafficMonitoringPageProps> = ({ onBack }) => {
    return (
        <div className="h-full bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Giám sát Giao thông</h1>
                    <button
                        onClick={onBack}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                        <i className="fas fa-arrow-left"></i>
                        <span>Quay lại</span>
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center">
                        <i className="fas fa-traffic-light text-orange-500 mr-2"></i>
                        Traffic Monitoring Dashboard
                    </h2>
                    <p className="text-gray-600 mb-4">
                        Tính năng giám sát giao thông cho phép theo dõi tình trạng giao thông
                        thời gian thực trên các tuyến đường được tối ưu hóa.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-green-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-green-700 text-sm font-medium">Tình trạng chung</p>
                                    <p className="text-2xl font-bold text-green-800">Tốt</p>
                                </div>
                                <i className="fas fa-check-circle text-3xl text-green-500"></i>
                            </div>
                        </div>

                        <div className="bg-yellow-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-yellow-700 text-sm font-medium">Tốc độ trung bình</p>
                                    <p className="text-2xl font-bold text-yellow-800">45 km/h</p>
                                </div>
                                <i className="fas fa-tachometer-alt text-3xl text-yellow-500"></i>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-700 text-sm font-medium">Tuyến đường</p>
                                    <p className="text-2xl font-bold text-blue-800">8 Routes</p>
                                </div>
                                <i className="fas fa-route text-3xl text-blue-500"></i>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-100 rounded-lg p-8 text-center">
                        <i className="fas fa-map-marked-alt text-6xl text-gray-400 mb-4"></i>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">
                            Traffic Map sẽ hiển thị tại đây
                        </h3>
                        <p className="text-gray-500">
                            Tích hợp với Google Maps/Track Asia APIs để hiển thị
                            thông tin giao thông thời gian thực
                        </p>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="font-semibold mb-3 flex items-center">
                                <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                                Cảnh báo giao thông
                            </h4>
                            <div className="space-y-2">
                                <div className="bg-red-100 p-2 rounded text-sm">
                                    <span className="font-medium">Tắc đường:</span> Đường ABC km 15-18
                                </div>
                                <div className="bg-yellow-100 p-2 rounded text-sm">
                                    <span className="font-medium">Chậm:</span> Ngã tư XYZ
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="font-semibold mb-3 flex items-center">
                                <i className="fas fa-chart-line text-blue-500 mr-2"></i>
                                Thống kê
                            </h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span>Thời gian di chuyển trung bình:</span>
                                    <span className="font-medium">25 phút</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Độ trễ so với dự kiến:</span>
                                    <span className="font-medium text-green-600">+2 phút</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Tuyến đường tối ưu:</span>
                                    <span className="font-medium">87%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrafficMonitoringPage;
