import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../../styles/google-maps.css';

const GoogleMapsPage = () => {
    const mapContainer = useRef(null);
    const [map, setMap] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCity, setSelectedCity] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [trafficVisible, setTrafficVisible] = useState(false);
    const [routeInfo, setRouteInfo] = useState(null);
    const [mapStyle, setMapStyle] = useState('roadmap');
    const [trafficData, setTrafficData] = useState(null);
    const [directionsService, setDirectionsService] = useState(null);
    const [directionsRenderer, setDirectionsRenderer] = useState(null);
    const [trafficLayer, setTrafficLayer] = useState(null);
    const [markers, setMarkers] = useState([]);

    // Vietnamese cities
    const vietnameseCities = [
        { name: 'Hà Nội', lat: 21.028511, lng: 105.804817 },
        { name: 'Hồ Chí Minh', lat: 10.762622, lng: 106.660172 },
        { name: 'Đà Nẵng', lat: 16.047079, lng: 108.206230 },
        { name: 'Hải Phòng', lat: 20.844912, lng: 106.687972 },
        { name: 'Cần Thơ', lat: 10.045162, lng: 105.746857 },
        { name: 'Nha Trang', lat: 12.238791, lng: 109.196749 },
        { name: 'Huế', lat: 16.463713, lng: 107.590866 },
        { name: 'Vũng Tàu', lat: 10.346212, lng: 107.084282 }
    ];

    // Load Google Maps API
    const loadGoogleMapsAPI = () => {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.maps) {
                resolve(window.google);
                return;
            }

            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            console.log('Google Maps API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined');
            console.log('🔍 Debug: Checking API key and billing status...');
            console.log('📋 Troubleshooting guide: Check GOOGLE_MAPS_BILLING_GUIDE.md');

            if (!apiKey) {
                reject(new Error('Google Maps API key is not configured. Please update VITE_GOOGLE_MAPS_API_KEY in your .env file.'));
                return;
            }

            // Check if script already exists
            const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
            if (existingScript) {
                // Wait for existing script to load
                if (window.google && window.google.maps) {
                    resolve(window.google);
                } else {
                    const checkGoogle = setInterval(() => {
                        if (window.google && window.google.maps) {
                            clearInterval(checkGoogle);
                            resolve(window.google);
                        }
                    }, 100);

                    setTimeout(() => {
                        clearInterval(checkGoogle);
                        reject(new Error('Google Maps API failed to load'));
                    }, 10000);
                }
                return;
            }

            // Use a simpler callback approach
            window.initGoogleMapsCallback = () => {
                resolve(window.google);
                delete window.initGoogleMapsCallback;
            };

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=initGoogleMapsCallback`;
            script.async = true;
            script.defer = true;

            script.onerror = (event) => {
                delete window.initGoogleMapsCallback;
                let errorMessage = 'Google Maps API failed to load';

                // Check for specific error types
                if (event.target && event.target.src) {
                    if (event.target.src.includes('googleapis.com')) {
                        errorMessage += '. Có thể do:\n' +
                            '• Ad Blocker đang chặn Google APIs\n' +
                            '• Cài đặt CSP của browser quá strict\n' +
                            '• API key không hợp lệ hoặc hết hạn\n' +
                            '• Network firewall chặn googleapis.com';
                    }
                }

                reject(new Error(errorMessage));
            };

            document.head.appendChild(script);

            // Add timeout to prevent hanging
            setTimeout(() => {
                if (!window.google || !window.google.maps) {
                    delete window.initGoogleMapsCallback;
                    reject(new Error('Google Maps API load timeout. Có thể do:\n• Kết nối internet chậm\n• API key không hợp lệ\n• Google APIs bị chặn'));
                }
            }, 15000); // 15 second timeout
        });
    };

    // Initialize Google Maps
    useEffect(() => {
        let mounted = true;

        // Prevent duplicate initialization in React strict mode
        if (map) return;

        const initializeMap = async () => {
            try {
                setIsLoading(true);
                setError(null);

                console.log('Loading Google Maps API...');
                console.log('API Key available:', !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

                await loadGoogleMapsAPI();

                if (!mounted) return;

                // Create map
                const mapInstance = new window.google.maps.Map(mapContainer.current, {
                    center: { lat: 21.0227, lng: 105.8194 }, // Hai Bà Trưng, Hà Nội
                    zoom: 12,
                    mapTypeId: 'roadmap',
                    streetViewControl: true,
                    mapTypeControl: true,
                    fullscreenControl: true,
                    zoomControl: true
                });

                // Initialize services
                const directionsServiceInstance = new window.google.maps.DirectionsService();
                const directionsRendererInstance = new window.google.maps.DirectionsRenderer({
                    suppressMarkers: false,
                    draggable: true
                });
                directionsRendererInstance.setMap(mapInstance);

                // Initialize traffic layer
                const trafficLayerInstance = new window.google.maps.TrafficLayer();

                setMap(mapInstance);
                setDirectionsService(directionsServiceInstance);
                setDirectionsRenderer(directionsRendererInstance);
                setTrafficLayer(trafficLayerInstance);
                setIsLoading(false);

                console.log('Google Maps initialized successfully!');

                // Monitor for billing errors
                window.addEventListener('error', (event) => {
                    if (event.message && event.message.includes('BillingNotEnabledMapError')) {
                        console.error('🚨 Billing Error Detected:', event.message);
                        setError(`🚨 Lỗi Billing phát hiện sau khi load!\n\nGoogle Maps API đã load nhưng billing chưa đúng.\n\nVui lòng:\n1. Kiểm tra billing account active\n2. Kích hoạt Maps JavaScript API\n3. Đợi 5-10 phút\n4. Refresh trang\n\n📋 Chi tiết: GOOGLE_MAPS_BILLING_GUIDE.md`);
                        setIsLoading(false);
                    }
                });

                // Load initial traffic data
                setTimeout(() => {
                    getTrafficDataForLocation(21.0227, 105.8194);
                }, 1000);

            } catch (err) {
                console.error('Failed to initialize Google Maps:', err);
                if (mounted) {
                    // Check specific error types
                    if (err.message.includes('BillingNotEnabledMapError') ||
                        (window.google && window.google.maps && window.google.maps.BillingNotEnabledMapError)) {
                        setError(`🚨 Lỗi Billing Google Maps\n\nBilling account chưa được kích hoạt đúng cách!\n\nCác bước khắc phục:\n1. Vào Google Cloud Console\n2. Kích hoạt billing account\n3. Enable Maps JavaScript API\n4. Kiểm tra API key restrictions\n5. Đợi 5-10 phút cho propagation\n\n📋 Xem chi tiết: GOOGLE_MAPS_BILLING_GUIDE.md`);
                    } else if (err.message.includes('API key') || err.message.includes('failed to load')) {
                        setError(`Google Maps API không thể tải: ${err.message}\n\nVui lòng:\n1. Kiểm tra API key trong file .env\n2. Đảm bảo API key có quyền truy cập Maps JavaScript API\n3. Kiểm tra billing account của Google Cloud\n4. Tắt Ad Blocker (uBlock Origin, AdBlock)\n5. Thử Incognito mode`);
                    } else {
                        setError(err.message);
                    }
                    setIsLoading(false);
                }
            }
        };

        initializeMap();

        return () => {
            mounted = false;
            // Cleanup map instance
            if (map) {
                window.google && window.google.maps && window.google.maps.event &&
                    window.google.maps.event.clearInstanceListeners(map);
            }
        };
    }, []);

    // Search places using Google Places API
    const handleSearch = useCallback(async (query) => {
        if (!map || !query.trim()) return;

        try {
            const service = new window.google.maps.places.PlacesService(map);
            const request = {
                query: query,
                fields: ['name', 'geometry', 'place_id', 'formatted_address'],
                locationBias: map.getCenter()
            };

            service.textSearch(request, (results, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
                    const place = results[0];
                    map.setCenter(place.geometry.location);
                    map.setZoom(15);

                    // Clear existing markers
                    clearMarkers();

                    // Add marker for searched location
                    const marker = new window.google.maps.Marker({
                        position: place.geometry.location,
                        map: map,
                        title: place.name
                    });

                    const infoWindow = new window.google.maps.InfoWindow({
                        content: `
                            <div>
                                <h3>${place.name}</h3>
                                <p>${place.formatted_address}</p>
                            </div>
                        `
                    });

                    marker.addListener('click', () => {
                        infoWindow.open(map, marker);
                    });

                    setMarkers([marker]);

                    // Get traffic data for this location
                    const lat = place.geometry.location.lat();
                    const lng = place.geometry.location.lng();
                    getTrafficDataForLocation(lat, lng);
                }
            });

        } catch (error) {
            console.error('Search error:', error);
        }
    }, [map]);

    // Debounced search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchQuery) {
                handleSearch(searchQuery);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, handleSearch]);

    // Navigate to selected city
    const handleCitySelect = (cityName) => {
        if (!map) return;

        const city = vietnameseCities.find(c => c.name === cityName);
        if (city) {
            map.setCenter({ lat: city.lat, lng: city.lng });
            map.setZoom(12);
            setSelectedCity(cityName);

            // Clear existing markers
            clearMarkers();

            // Add marker for city
            const marker = new window.google.maps.Marker({
                position: { lat: city.lat, lng: city.lng },
                map: map,
                title: city.name
            });

            setMarkers([marker]);

            // Get traffic data for the city
            getTrafficDataForLocation(city.lat, city.lng);
        }
    };

    // Clear all markers
    const clearMarkers = () => {
        markers.forEach(marker => {
            marker.setMap(null);
        });
        setMarkers([]);
    };

    // Toggle traffic layer
    const toggleTraffic = () => {
        if (!trafficLayer || !map) return;

        if (trafficVisible) {
            trafficLayer.setMap(null);
            setTrafficVisible(false);
            console.log('Traffic layer hidden');
        } else {
            trafficLayer.setMap(map);
            setTrafficVisible(true);
            console.log('Traffic layer visible');
        }
    };

    // Switch map style
    const handleStyleChange = (style) => {
        if (!map) return;

        const mapTypeMap = {
            'roadmap': window.google.maps.MapTypeId.ROADMAP,
            'satellite': window.google.maps.MapTypeId.SATELLITE,
            'hybrid': window.google.maps.MapTypeId.HYBRID,
            'terrain': window.google.maps.MapTypeId.TERRAIN
        };

        if (mapTypeMap[style]) {
            map.setMapTypeId(mapTypeMap[style]);
            setMapStyle(style);
            console.log('Map style changed to:', style);
        }
    };

    // Get traffic data for location (simulated)
    const getTrafficDataForLocation = async (lat, lng) => {
        try {
            console.log('Getting traffic data for location:', lat, lng);

            // Simulate Google Maps traffic data
            const trafficData = {
                location: { lat, lng },
                congestion: ['free', 'light', 'moderate', 'heavy'][Math.floor(Math.random() * 4)],
                speed: {
                    current: Math.round(20 + Math.random() * 40),
                    freeFlow: Math.round(50 + Math.random() * 20),
                    ratio: 0.6 + Math.random() * 0.4
                },
                travelTime: {
                    current: Math.round(10 + Math.random() * 20),
                    freeFlow: Math.round(8 + Math.random() * 12)
                },
                incidents: Math.random() > 0.7 ? [
                    {
                        type: 'accident',
                        description: 'Tai nạn giao thông',
                        severity: 'moderate'
                    }
                ] : [],
                lastUpdated: new Date().toISOString(),
                dataSource: 'Google Maps API'
            };

            console.log('Traffic data received:', trafficData);
            setTrafficData(trafficData);

        } catch (error) {
            console.error('Error getting traffic data:', error);
            setTrafficData({
                location: { lat, lng },
                congestion: 'unknown',
                speed: { current: 0, freeFlow: 0, ratio: 0 },
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

    // Calculate route between two points
    const calculateRoute = (start, end) => {
        if (!directionsService || !directionsRenderer) return;

        const request = {
            origin: start,
            destination: end,
            travelMode: window.google.maps.TravelMode.DRIVING,
            avoidTolls: false,
            avoidHighways: false
        };

        directionsService.route(request, (result, status) => {
            if (status === window.google.maps.DirectionsStatus.OK) {
                directionsRenderer.setDirections(result);

                const route = result.routes[0];
                const leg = route.legs[0];

                setRouteInfo({
                    distance: leg.distance.text,
                    duration: leg.duration.text,
                    summary: route.summary
                });

                console.log('Route calculated:', route);
            } else {
                console.error('Directions request failed:', status);
            }
        });
    };

    // Format congestion level
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
                        {/* Error Header */}
                        <div className="bg-red-600 px-6 py-4">
                            <div className="flex items-center">
                                <div className="bg-white bg-opacity-20 p-3 rounded-xl">
                                    <i className="fas fa-exclamation-triangle text-white text-2xl"></i>
                                </div>
                                <div className="ml-4">
                                    <h3 className="text-white font-bold text-xl">
                                        Lỗi tải Google Maps
                                    </h3>
                                    <p className="text-red-100 text-sm">
                                        Không thể kết nối đến Google Maps API
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Error Content */}
                        <div className="p-6">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                <div className="text-sm text-red-700">
                                    <p className="font-medium mb-2">Chi tiết lỗi:</p>
                                    <p className="font-mono text-xs bg-red-100 p-2 rounded">{error}</p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Troubleshooting */}
                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                                    <h4 className="font-semibold text-yellow-800 mb-3">
                                        🔧 Các bước khắc phục:
                                    </h4>
                                    <ul className="text-sm text-yellow-700 space-y-2">
                                        <li>• Kiểm tra Google Maps API key</li>
                                        <li>• Enable Maps JavaScript API</li>
                                        <li>• Enable Places API</li>
                                        <li>• Kiểm tra billing account ACTIVE</li>
                                        <li>• Tắt Ad Blocker (uBlock Origin, etc.)</li>
                                        <li>• Disable CSP strict mode trong browser</li>
                                        <li>• Thử refresh trang (Ctrl+F5)</li>
                                        <li>• Thử Incognito mode</li>
                                        <li>• Đợi 5-10 phút sau khi kích hoạt billing</li>
                                    </ul>
                                    <div className="mt-4 pt-4 border-t border-yellow-200">
                                        <p className="text-xs text-yellow-600">
                                            📋 Xem chi tiết: GOOGLE_MAPS_BILLING_GUIDE.md
                                        </p>
                                    </div>
                                </div>

                                {/* Google Maps Info */}
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <h4 className="font-semibold text-blue-800 mb-3">
                                        🌍 Về Google Maps API:
                                    </h4>
                                    <ul className="text-sm text-blue-700 space-y-2">
                                        <li>• API Maps toàn cầu chính xác cao</li>
                                        <li>• Traffic data real-time</li>
                                        <li>• Places, routing đầy đủ</li>
                                        <li>• $7/1000 requests</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="flex justify-center space-x-4 mt-6">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-all duration-200 flex items-center"
                                >
                                    <i className="fas fa-redo mr-2"></i>
                                    Tải lại trang
                                </button>
                                <a
                                    href="https://console.cloud.google.com/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-white border-2 border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 flex items-center"
                                >
                                    <i className="fas fa-external-link-alt mr-2"></i>
                                    Google Cloud Console
                                </a>
                                <button
                                    onClick={() => window.open('./GOOGLE_MAPS_BILLING_GUIDE.md', '_blank')}
                                    className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 transition-all duration-200 flex items-center"
                                >
                                    <i className="fas fa-book mr-2"></i>
                                    Billing Guide
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-lg border-b-2 border-blue-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="bg-red-600 p-3 rounded-xl">
                                    <i className="fab fa-google text-white text-2xl"></i>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-red-600">
                                        <i className="fab fa-google mr-2"></i>
                                        Google Maps
                                    </h1>
                                    <p className="text-gray-600 text-sm mt-1">
                                        Global mapping solution - Traffic monitoring & Navigation
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="hidden md:flex items-center space-x-3 text-sm">
                                    <div className="flex items-center bg-green-50 px-3 py-1 rounded-full">
                                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                        <span className="text-green-700 font-medium">API Connected</span>
                                    </div>
                                    <div className="text-gray-500">|</div>
                                    <a
                                        href="https://maps.google.com/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-red-600 hover:text-red-800 font-medium transition-colors"
                                    >
                                        Google Maps Official →
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left Sidebar - Controls */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-6 border border-gray-100">
                            {/* Control Panel Header */}
                            <div className="text-center pb-4 border-b border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800 mb-2">
                                    <i className="fas fa-sliders-h text-red-600 mr-2"></i>
                                    Bảng điều khiển
                                </h2>
                                <p className="text-xs text-gray-500">
                                    Google Maps API Controls
                                </p>
                            </div>

                            {/* Search Box */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    <i className="fas fa-search text-red-600 mr-2"></i>
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
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                                    />
                                </div>
                            </div>

                            {/* Quick City Navigation */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    <i className="fas fa-city text-red-600 mr-2"></i>
                                    Thành phố lớn
                                </label>
                                <select
                                    value={selectedCity}
                                    onChange={(e) => handleCitySelect(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white cursor-pointer"
                                >
                                    <option value="">Chọn thành phố để khám phá</option>
                                    {vietnameseCities.map((city) => (
                                        <option key={city.name} value={city.name}>
                                            {city.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Map Style */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    <i className="fas fa-palette text-red-600 mr-2"></i>
                                    Kiểu bản đồ
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: 'roadmap', label: 'Đường phố', icon: 'fas fa-road' },
                                        { value: 'satellite', label: 'Vệ tinh', icon: 'fas fa-satellite' },
                                        { value: 'hybrid', label: 'Lai', icon: 'fas fa-layer-group' },
                                        { value: 'terrain', label: 'Địa hình', icon: 'fas fa-mountain' }
                                    ].map((style) => (
                                        <button
                                            key={style.value}
                                            onClick={() => handleStyleChange(style.value)}
                                            className={`p-3 rounded-lg text-xs font-medium transition-all duration-200 ${mapStyle === style.value
                                                ? 'bg-red-100 text-red-700 border-2 border-red-300'
                                                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                                                }`}
                                            title={`Chuyển sang kiểu bản đồ ${style.label.toLowerCase()}`}
                                        >
                                            <div className="text-lg mb-1">
                                                <i className={style.icon}></i>
                                            </div>
                                            {style.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Traffic Toggle */}
                            <div className="bg-red-50 rounded-xl p-4">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={trafficVisible}
                                        onChange={toggleTraffic}
                                        className="rounded border-gray-300 text-red-600 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50 w-5 h-5"
                                    />
                                    <span className="ml-3 text-sm font-medium text-gray-700">
                                        <i className="fas fa-traffic-light text-red-600 mr-2"></i>
                                        Google Traffic Layer
                                    </span>
                                </label>
                                <p className="text-xs text-gray-500 mt-2 ml-8">
                                    Hiển thị lớp giao thông real-time của Google
                                </p>
                            </div>

                            {/* Traffic Data */}
                            {trafficData && (
                                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                                            <i className="fab fa-google text-red-600 mr-2"></i>
                                            Thông tin giao thông
                                        </h3>
                                        <button
                                            onClick={() => {
                                                if (trafficData && trafficData.location) {
                                                    getTrafficDataForLocation(trafficData.location.lat, trafficData.location.lng);
                                                }
                                            }}
                                            className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors flex items-center"
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

                                        {/* Data Source Indicator */}
                                        <div className="pt-2 border-t border-green-100">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-gray-500 flex items-center">
                                                    <i className="fas fa-database text-gray-400 mr-1"></i>
                                                    Nguồn dữ liệu:
                                                </span>
                                                <span className="font-medium text-green-600">
                                                    {trafficData.dataSource === 'Google Maps API' ? 'Google Maps API (Simulated)' : trafficData.dataSource}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs mt-1">
                                                <span className="text-gray-500 flex items-center">
                                                    <i className="fas fa-clock text-gray-400 mr-1"></i>
                                                    Cập nhật lúc:
                                                </span>
                                                <span className="text-gray-600">
                                                    {new Date(trafficData.lastUpdated).toLocaleTimeString('vi-VN')}
                                                </span>
                                            </div>
                                        </div>

                                        {trafficData.incidents && trafficData.incidents.length > 0 && (
                                            <div className="mt-4 pt-3 border-t border-green-200">
                                                <div className="text-sm text-gray-600 mb-2 flex items-center">
                                                    <i className="fas fa-exclamation-triangle text-orange-500 mr-2"></i>
                                                    Sự cố:
                                                </div>
                                                {trafficData.incidents.map((incident, index) => (
                                                    <div key={index} className={`text-xs p-3 rounded-lg border mb-2 ${incident.type === 'error' ? 'text-red-700 bg-red-50 border-red-200' :
                                                        'text-orange-700 bg-orange-50 border-orange-200'
                                                        }`}>
                                                        <i className={`${incident.type === 'error' ? 'fas fa-exclamation-circle' :
                                                            incident.type === 'construction' ? 'fas fa-tools' :
                                                                'fas fa-car-crash'
                                                            } mr-2`}></i>
                                                        {incident.description}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Route Information */}
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
                                                if (directionsRenderer) {
                                                    directionsRenderer.setDirections({ routes: [] });
                                                }
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

                    {/* Map Container */}
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                            {/* Map Header */}
                            <div className="bg-red-600 px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                                            <i className="fab fa-google text-white text-lg"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-lg">Google Maps</h3>
                                            <p className="text-red-100 text-sm">Global mapping with real-time traffic data</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="bg-white bg-opacity-20 px-3 py-1 rounded-full">
                                            <span className="text-white text-xs font-medium">Global Coverage</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {isLoading && (
                                <div className="flex items-center justify-center h-96 bg-gray-50">
                                    <div className="text-center">
                                        <div className="relative">
                                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-200 border-t-red-600 mx-auto"></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <i className="fab fa-google text-red-600 text-lg"></i>
                                            </div>
                                        </div>
                                        <p className="mt-4 text-gray-600 font-medium">
                                            <i className="fab fa-google text-red-600 mr-2"></i>
                                            Đang tải Google Maps...
                                        </p>
                                        <p className="text-sm text-gray-500 mt-2">
                                            Đang kết nối đến Google Maps API
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div
                                ref={mapContainer}
                                className={`w-full h-96 lg:h-[600px] relative ${isLoading ? 'hidden' : ''}`}
                                style={{
                                    width: '100%',
                                    height: '600px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    minHeight: '600px'
                                }}
                            />

                            {/* Map Legend */}
                            {!isLoading && (
                                <div className="p-4 bg-gray-50 border-t border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-6 text-xs">
                                            <div className="text-gray-600 font-medium mb-1">Google Traffic Legend:</div>
                                            <div className="flex items-center space-x-4">
                                                <div className="flex items-center">
                                                    <div className="w-4 h-2 bg-green-400 rounded-full mr-2"></div>
                                                    <span className="text-gray-600">Fast</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <div className="w-4 h-2 bg-yellow-400 rounded-full mr-2"></div>
                                                    <span className="text-gray-600">Slow</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <div className="w-4 h-2 bg-orange-400 rounded-full mr-2"></div>
                                                    <span className="text-gray-600">Moderate</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <div className="w-4 h-2 bg-red-400 rounded-full mr-2"></div>
                                                    <span className="text-gray-600">Heavy</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                                            <i className="fab fa-google text-red-500"></i>
                                            <span>Powered by Google Maps</span>
                                            <span className="text-gray-300">|</span>
                                            <span className="text-red-600 font-medium flex items-center">
                                                Global Coverage
                                                <i className="fas fa-globe ml-1"></i>
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

export default GoogleMapsPage;
