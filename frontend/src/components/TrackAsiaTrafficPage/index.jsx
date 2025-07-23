import React, { useState, useEffect, useRef, useCallback } from 'react';
import TrackAsiaService from '../../services/TrackAsiaService';
import trackAsiaLoader from '../../utils/TrackAsiaLoader';
import '../../styles/track-asia.css';

const TrackAsiaTrafficPage = () => {
    const mapContainer = useRef(null);
    const [trafficService, setTrafficService] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCity, setSelectedCity] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [trafficVisible, setTrafficVisible] = useState(true);
    const [routeInfo, setRouteInfo] = useState(null);
    const [mapStyle, setMapStyle] = useState('street');
    const [trafficData, setTrafficData] = useState(null);

    useEffect(() => {
        if (trafficService && trafficService.map) {
            const handleResize = () => {
                setTimeout(() => trafficService.map.resize(), 100);
            };
            window.addEventListener('resize', handleResize);
            setTimeout(() => trafficService.map.resize(), 300);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, [trafficService]);

    useEffect(() => {
        let mounted = true;
        const initializeMap = async () => {
            try {
                setIsLoading(true);
                setError(null);
                await trackAsiaLoader.load();
                if (!mounted) return;
                const service = new TrackAsiaService();
                await service.initializeMap('track-asia-map', {
                    zoom: 11,
                    center: [105.8194, 21.0227]
                });
                if (!mounted) return;
                setTrafficService(service);
                setTrafficVisible(service.isTrafficVisible());
                setIsLoading(false);
                setTimeout(() => getTrafficDataForLocation(21.0227, 105.8194), 1000);
            } catch (err) {
                console.error('Failed to initialize Track Asia Map:', err);
                if (mounted) {
                    setError(err.message);
                    setIsLoading(false);
                }
            }
        };
        initializeMap();
        return () => {
            mounted = false;
            if (trafficService) {
                trafficService.destroy();
            }
        };
    }, []);

    const handleSearch = useCallback(async (query) => {
        if (!trafficService || !query.trim()) {
            setSearchResults([]);
            return;
        }
        try {
            const results = await trafficService.searchPlaces(query);
            setSearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
            setSearchResults([]);
        }
    }, [trafficService]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchQuery) {
                handleSearch(searchQuery);
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, handleSearch]);

    const handleCitySelect = (cityName) => {
        if (!trafficService) return;
        const city = trafficService.navigateToCity(cityName);
        if (city) {
            setSelectedCity(cityName);
            getTrafficDataForLocation(city.lat, city.lng);
        }
    };

    const handleSearchResultSelect = (result) => {
        if (!trafficService || !result.center) return;
        const [lng, lat] = result.center;
        trafficService.map.flyTo({
            center: [lng, lat],
            zoom: 14,
            duration: 2000
        });
        trafficService.clearMarkers();
        trafficService.addMarker({ lat, lng }, {
            popup: `<strong>${result.place_name}</strong>`
        });
        setSearchQuery('');
        setSearchResults([]);
        getTrafficDataForLocation(lat, lng);
    };

    const getTrafficDataForLocation = async (lat, lng) => {
        if (!trafficService) return;
        try {
            const data = await trafficService.getTrafficConditions(lat, lng);
            setTrafficData(data);
        } catch (error) {
            console.error('Error getting traffic data:', error);
            setTrafficData({
                location: { lat, lng },
                congestion: 'unknown',
                speed: { current: 0, freeFlow: 0, ratio: 0 },
                travelTime: { current: 0, freeFlow: 0 },
                incidents: [{
                    type: 'error',
                    description: 'Không thể tải dữ liệu giao thông',
                    severity: 'high'
                }],
                lastUpdated: new Date().toISOString(),
                dataSource: 'error'
            });
        }
    };

    const toggleTraffic = () => {
        if (!trafficService) return;
        const isVisible = trafficService.toggleTrafficLayer();
        setTrafficVisible(isVisible);
    };

    const handleStyleChange = (style) => {
        if (!trafficService) {
            console.warn('Cannot change style: trafficService not initialized');
            return;
        }
        if (!trafficService.isValidStyle || !trafficService.isValidStyle(style)) {
            console.error('Invalid style:', style);
            return;
        }
        try {
            trafficService.switchMapStyle(style);
            setMapStyle(style);
            if (style === 'traffic') {
                setTrafficVisible(true);
            }
        } catch (error) {
            console.error('Error changing map style:', error);
        }
    };

    const calculateRoute = async (start, end) => {
        if (!trafficService) return;
        try {
            const routes = await trafficService.calculateRoute(start, end);
            if (routes.length > 0) {
                const route = routes[0];
                trafficService.displayRoute(route);
                setRouteInfo({
                    distance: (route.distance / 1000).toFixed(1) + ' km',
                    duration: Math.round(route.duration / 60) + ' phút',
                    summary: route.legs?.[0]?.summary || 'Tuyến đường được tính toán'
                });
            }
        } catch (error) {
            console.error('Error calculating route:', error);
        }
    };

    const formatCongestion = (level) => {
        const levels = {
            'free': { text: 'Thông thoáng', color: 'text-green-600', bg: 'bg-green-100' },
            'light': { text: 'Tắc nghẽn nhẹ', color: 'text-yellow-600', bg: 'bg-yellow-100' },
            'moderate': { text: 'Tắc nghẽn vừa', color: 'text-orange-600', bg: 'bg-orange-100' },
            'heavy': { text: 'Tắc nghẽn nặng', color: 'text-red-600', bg: 'bg-red-100' },
            'unknown': { text: 'Không xác định', color: 'text-gray-600', bg: 'bg-gray-100' }
        };
        return levels[level] || levels['unknown'];
    };

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-4xl mx-auto pt-20 px-6">
                    <div className="bg-white rounded-2xl shadow-xl border border-red-100 overflow-hidden">
                        <div className="bg-red-600 px-6 py-4">
                            <div className="flex items-center">
                                <div className="bg-white bg-opacity-20 p-3 rounded-xl">
                                    <i className="fas fa-exclamation-triangle text-white text-2xl"></i>
                                </div>
                                <div className="ml-4">
                                    <h3 className="text-white font-bold text-xl">Lỗi tải Track Asia Maps</h3>
                                    <p className="text-red-100 text-sm">Không thể kết nối đến dịch vụ Track Asia Maps</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-6 border border-gray-100">
                            <div className="text-center pb-4 border-b border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800 mb-2">
                                    <i className="fas fa-sliders-h text-blue-600 mr-2"></i>
                                    Bảng điều khiển
                                </h2>
                                <p className="text-xs text-gray-500">Tùy chỉnh và điều khiển bản đồ</p>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    <i className="fas fa-search text-blue-600 mr-2"></i>
                                    Tìm kiếm địa điểm
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <i className="fas fa-search text-gray-400"></i>
                                    </div>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Nhập tên địa điểm, đường, quận..."
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                                    />
                                    {searchResults.length > 0 && (
                                        <div className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                                            {searchResults.map((result, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => handleSearchResultSelect(result)}
                                                    className="w-full px-4 py-3 text-left hover:bg-blue-50 text-sm border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                                                >
                                                    <div className="font-medium text-gray-900">{result.place_name}</div>
                                                    {result.place_type && (
                                                        <div className="text-gray-500 text-xs mt-1 flex items-center">
                                                            <i className="fas fa-map-pin text-blue-400 mr-1"></i>
                                                            {result.place_type.join(', ')}
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    <i className="fas fa-city text-blue-600 mr-2"></i>
                                    Thành phố lớn
                                </label>
                                <select
                                    value={selectedCity}
                                    onChange={(e) => handleCitySelect(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white cursor-pointer"
                                >
                                    <option value="">Chọn thành phố để khám phá</option>
                                    {trafficService?.getVietnameseCities().map((city) => (
                                        <option key={city.name} value={city.name}>{city.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    <i className="fas fa-palette text-blue-600 mr-2"></i>
                                    Kiểu bản đồ
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: 'street', label: 'Đường phố', icon: 'fas fa-road' },
                                        { value: 'satellite', label: 'Vệ tinh', icon: 'fas fa-satellite' },
                                        { value: 'traffic', label: 'Giao thông', icon: 'fas fa-traffic-light' }
                                    ].map((style) => (
                                        <button
                                            key={style.value}
                                            onClick={() => handleStyleChange(style.value)}
                                            className={`p-3 rounded-lg text-xs font-medium transition-all duration-200 ${mapStyle === style.value ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'} ${style.value === 'traffic' && trafficVisible ? 'ring-2 ring-green-300' : ''}`}
                                            title={style.value === 'traffic' ? 'Hiển thị lớp giao thông trên bản đồ hiện tại' : `Chuyển sang kiểu bản đồ ${style.label.toLowerCase()}`}
                                        >
                                            <div className="text-lg mb-1">
                                                <i className={style.icon}></i>
                                                {style.value === 'traffic' && trafficVisible && (
                                                    <i className="fas fa-circle text-green-500 text-xs ml-1"></i>
                                                )}
                                            </div>
                                            {style.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-4">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={trafficVisible}
                                        onChange={toggleTraffic}
                                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 w-5 h-5"
                                    />
                                    <span className="ml-3 text-sm font-medium text-gray-700">
                                        <i className="fas fa-traffic-light text-red-600 mr-2"></i>
                                        Hiển thị lớp giao thông
                                    </span>
                                </label>
                                <p className="text-xs text-gray-500 mt-2 ml-8">Bật/tắt hiển thị tình trạng giao thông trên bản đồ</p>
                            </div>
                            {trafficData && (
                                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                                            <i className="fas fa-chart-line text-green-600 mr-2"></i>
                                            Thông tin giao thông
                                        </h3>
                                        <button
                                            onClick={() => {
                                                if (trafficData && trafficData.location) {
                                                    getTrafficDataForLocation(trafficData.location.lat, trafficData.location.lng);
                                                }
                                            }}
                                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors flex items-center"
                                            title="Làm mới dữ liệu giao thông"
                                        >
                                            <i className="fas fa-sync-alt mr-1"></i>
                                            Làm mới
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600 flex items-center">
                                                <i className="fas fa-traffic-light text-gray-400 mr-2"></i>
                                                Tình trạng:
                                            </span>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${formatCongestion(trafficData.congestion).bg} ${formatCongestion(trafficData.congestion).color}`}>
                                                {formatCongestion(trafficData.congestion).text}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600 flex items-center">
                                                <i className="fas fa-tachometer-alt text-gray-400 mr-2"></i>
                                                Tốc độ hiện tại:
                                            </span>
                                            <span className="text-sm font-semibold text-blue-600">{trafficData.speed.current} km/h</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600 flex items-center">
                                                <i className="fas fa-rocket text-gray-400 mr-2"></i>
                                                Tốc độ tối đa:
                                            </span>
                                            <span className="text-sm font-semibold text-green-600">{trafficData.speed.freeFlow} km/h</span>
                                        </div>
                                        <div className="pt-2 border-t border-green-100">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-gray-500 flex items-center">
                                                    <i className="fas fa-database text-gray-400 mr-1"></i>
                                                    Nguồn dữ liệu:
                                                </span>
                                                <span className={`font-medium ${trafficData.dataSource === 'TrafficAPIService' ? 'text-green-600' : trafficData.dataSource === 'demo' ? 'text-orange-600' : 'text-red-600'}`}>
                                                    {trafficData.dataSource === 'TrafficAPIService' ? 'HERE Traffic API (Real Data)' : trafficData.dataSource === 'demo' ? 'Dữ liệu mẫu (Track Asia không có Traffic API)' : 'Lỗi kết nối'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs mt-1">
                                                <span className="text-gray-500 flex items-center">
                                                    <i className="fas fa-clock text-gray-400 mr-1"></i>
                                                    Cập nhật lúc:
                                                </span>
                                                <span className="text-gray-600">{new Date(trafficData.lastUpdated).toLocaleTimeString('vi-VN')}</span>
                                            </div>
                                        </div>
                                        {trafficData.incidents && trafficData.incidents.length > 0 && (
                                            <div className="mt-4 pt-3 border-t border-green-200">
                                                <div className="text-sm text-gray-600 mb-2 flex items-center">
                                                    <i className="fas fa-exclamation-triangle text-orange-500 mr-2"></i>
                                                    Sự cố:
                                                </div>
                                                {trafficData.incidents.map((incident, index) => (
                                                    <div key={index} className={`text-xs p-3 rounded-lg border mb-2 ${incident.type === 'error' ? 'text-red-700 bg-red-50 border-red-200' : 'text-orange-700 bg-orange-50 border-orange-200'}`}>
                                                        <i className={`${incident.type === 'error' ? 'fas fa-exclamation-circle' : incident.type === 'construction' ? 'fas fa-tools' : 'fas fa-car-crash'} mr-2`}></i>
                                                        {incident.description}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {routeInfo && (
                                <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                                        <i className="fas fa-route text-purple-600 mr-2"></i>
                                        Thông tin tuyến đường
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600 flex items-center">
                                                <i className="fas fa-ruler text-gray-400 mr-2"></i>
                                                Khoảng cách:
                                            </span>
                                            <span className="text-sm font-semibold text-purple-600">{routeInfo.distance}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600 flex items-center">
                                                <i className="fas fa-clock text-gray-400 mr-2"></i>
                                                Thời gian:
                                            </span>
                                            <span className="text-sm font-semibold text-purple-600">{routeInfo.duration}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-3 p-2 bg-white rounded border border-purple-100">
                                            <i className="fas fa-info-circle text-purple-400 mr-1"></i>
                                            {routeInfo.summary}
                                        </div>
                                        <button
                                            onClick={() => {
                                                trafficService?.clearRoute();
                                                setRouteInfo(null);
                                            }}
                                            className="w-full mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-all duration-200 flex items-center justify-center"
                                        >
                                            <i className="fas fa-trash mr-2"></i>
                                            Xóa tuyến đường
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                            <div className="bg-blue-600 px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                                            <i className="fas fa-map text-white text-lg"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-lg">Bản đồ Track Asia</h3>
                                            <p className="text-blue-100 text-sm">Giao diện tương tác với dữ liệu thời gian thực</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="bg-white bg-opacity-20 px-3 py-1 rounded-full">
                                            <span className="text-white text-xs font-medium">Vietnam Optimized</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {isLoading && (
                                <div className="flex items-center justify-center h-96 bg-gray-50">
                                    <div className="text-center">
                                        <div className="relative">
                                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <i className="fas fa-map-marked-alt text-blue-600 text-lg"></i>
                                            </div>
                                        </div>
                                        <p className="mt-4 text-gray-600 font-medium">
                                            <i className="fas fa-flag text-blue-600 mr-2"></i>
                                            Đang tải Track Asia Maps...
                                        </p>
                                        <p className="text-sm text-gray-500 mt-2">Đang kết nối đến server Track Asia</p>
                                    </div>
                                </div>
                            )}
                            <div
                                ref={mapContainer}
                                id="track-asia-map"
                                className={`w-full h-96 lg:h-[600px] relative ${isLoading ? 'hidden' : ''}`}
                                style={{
                                    width: '100%',
                                    height: '600px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    minHeight: '600px'
                                }}
                            />
                            {!isLoading && (
                                <div className="p-4 bg-gray-50 border-t border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-6 text-xs">
                                            <div className="text-gray-600 font-medium mb-1">Chú thích giao thông:</div>
                                            <div className="flex items-center space-x-4">
                                                <div className="flex items-center">
                                                    <div className="w-4 h-2 bg-green-400 rounded-full mr-2"></div>
                                                    <span className="text-gray-600">Thông thoáng</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <div className="w-4 h-2 bg-yellow-400 rounded-full mr-2"></div>
                                                    <span className="text-gray-600">Chậm</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <div className="w-4 h-2 bg-orange-400 rounded-full mr-2"></div>
                                                    <span className="text-gray-600">Tắc vừa</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <div className="w-4 h-2 bg-red-400 rounded-full mr-2"></div>
                                                    <span className="text-gray-600">Tắc nặng</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                                            <i className="fas fa-shield-alt text-green-500"></i>
                                            <span>Powered by Track Asia Maps</span>
                                            <span className="text-gray-300">|</span>
                                            <span className="text-blue-600 font-medium flex items-center">
                                                Made in Vietnam
                                                <i className="fas fa-flag ml-1"></i>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrackAsiaTrafficPage;
