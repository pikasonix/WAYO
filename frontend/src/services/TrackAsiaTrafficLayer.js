/**
 * Custom Traffic Layer for TrackAsia Maps
 * Compatible alternative to mapbox-gl-traffic
 */
class TrackAsiaTrafficLayer {
    constructor(options = {}) {
        this.options = {
            showTraffic: options.showTraffic !== false,
            showIncidents: options.showIncidents !== false,
            trafficSource: options.trafficSource || 'track-asia-traffic-v1',
            ...options
        };
        
        this.map = null;
        this.isVisible = false;
        this.isLoaded = false;
        this.container = null;
        this.button = null;
    }

    onAdd(map) {
        this.map = map;
        this.isLoaded = true;

        // Create control container
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        // Create traffic toggle button
        this.button = document.createElement('button');
        this.button.className = 'mapboxgl-ctrl-icon traffic-control';
        this.button.type = 'button';
        this.button.title = 'Toggle traffic layer';
        this.button.setAttribute('aria-label', 'Toggle traffic layer');
        
        // Add icon styling
        this.button.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cpath fill='%23333' d='M10 2C5.6 2 2 5.6 2 10s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z'/%3E%3Ccircle fill='%23ff0000' cx='10' cy='7' r='1.5'/%3E%3Ccircle fill='%23ffff00' cx='10' cy='10' r='1.5'/%3E%3Ccircle fill='%2300ff00' cx='10' cy='13' r='1.5'/%3E%3C/svg%3E")`;
        this.button.style.backgroundRepeat = 'no-repeat';
        this.button.style.backgroundPosition = 'center';
        this.button.style.backgroundSize = '20px 20px';

        // Add click handler
        this.button.addEventListener('click', () => {
            this.toggleTraffic();
        });

        this.container.appendChild(this.button);

        // Initialize traffic layer if enabled by default
        if (this.options.showTraffic) {
            this._initializeTrafficLayer();
        }

        return this.container;
    }

    onRemove() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this._removeTrafficLayer();
        this.map = null;
        this.isLoaded = false;
    }

    toggleTraffic() {
        if (!this.map || !this.isLoaded) {
            console.warn('Traffic layer not ready');
            return false;
        }

        if (this.isVisible) {
            this._hideTraffic();
        } else {
            this._showTraffic();
        }

        this._updateButtonState();
        return this.isVisible;
    }

    _initializeTrafficLayer() {
        if (!this.map) return;

        try {
            // Add traffic source if it doesn't exist
            if (!this.map.getSource('traffic')) {
                this.map.addSource('traffic', {
                    type: 'vector',
                    url: 'mapbox://mapbox.mapbox-traffic-v1'
                });
            }

            // Add traffic layers
            this._addTrafficLayers();
        } catch (error) {
            console.warn('Could not add Mapbox traffic source, using alternative:', error);
            this._addAlternativeTrafficLayer();
        }
    }

    _addTrafficLayers() {
        const layers = [
            {
                id: 'traffic-low',
                type: 'line',
                source: 'traffic',
                'source-layer': 'traffic',
                filter: ['==', 'congestion', 'low'],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': '#4CAF50',
                    'line-width': 3,
                    'line-opacity': 0.8
                }
            },
            {
                id: 'traffic-moderate',
                type: 'line',
                source: 'traffic',
                'source-layer': 'traffic',
                filter: ['==', 'congestion', 'moderate'],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': '#FFC107',
                    'line-width': 3,
                    'line-opacity': 0.8
                }
            },
            {
                id: 'traffic-heavy',
                type: 'line',
                source: 'traffic',
                'source-layer': 'traffic',
                filter: ['==', 'congestion', 'heavy'],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': '#FF5722',
                    'line-width': 3,
                    'line-opacity': 0.8
                }
            },
            {
                id: 'traffic-severe',
                type: 'line',
                source: 'traffic',
                'source-layer': 'traffic',
                filter: ['==', 'congestion', 'severe'],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': '#D32F2F',
                    'line-width': 3,
                    'line-opacity': 0.8
                }
            }
        ];

        layers.forEach(layer => {
            if (!this.map.getLayer(layer.id)) {
                this.map.addLayer(layer);
            }
        });
    }

    _addAlternativeTrafficLayer() {
        // Fallback: Add a demo traffic layer with sample data
        if (!this.map.getSource('demo-traffic')) {
            this.map.addSource('demo-traffic', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: {
                                congestion: 'heavy'
                            },
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    [106.660172, 10.762622],
                                    [106.665172, 10.767622],
                                    [106.670172, 10.772622]
                                ]
                            }
                        },
                        {
                            type: 'Feature',
                            properties: {
                                congestion: 'moderate'
                            },
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    [105.804817, 21.028511],
                                    [105.809817, 21.033511],
                                    [105.814817, 21.038511]
                                ]
                            }
                        }
                    ]
                }
            });

            this.map.addLayer({
                id: 'demo-traffic-heavy',
                type: 'line',
                source: 'demo-traffic',
                filter: ['==', 'congestion', 'heavy'],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': '#FF5722',
                    'line-width': 4,
                    'line-opacity': 0.8
                }
            });

            this.map.addLayer({
                id: 'demo-traffic-moderate',
                type: 'line',
                source: 'demo-traffic',
                filter: ['==', 'congestion', 'moderate'],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': '#FFC107',
                    'line-width': 4,
                    'line-opacity': 0.8
                }
            });
        }
    }

    _showTraffic() {
        if (!this.map) return;

        try {
            // Initialize traffic layer if not already done
            if (!this.map.getSource('traffic') && !this.map.getSource('demo-traffic')) {
                this._initializeTrafficLayer();
            }

            // Show traffic layers
            const trafficLayers = ['traffic-low', 'traffic-moderate', 'traffic-heavy', 'traffic-severe'];
            const demoLayers = ['demo-traffic-heavy', 'demo-traffic-moderate'];
            
            [...trafficLayers, ...demoLayers].forEach(layerId => {
                if (this.map.getLayer(layerId)) {
                    this.map.setLayoutProperty(layerId, 'visibility', 'visible');
                }
            });

            this.isVisible = true;
        } catch (error) {
            console.error('Error showing traffic layer:', error);
        }
    }

    _hideTraffic() {
        if (!this.map) return;

        try {
            const trafficLayers = ['traffic-low', 'traffic-moderate', 'traffic-heavy', 'traffic-severe'];
            const demoLayers = ['demo-traffic-heavy', 'demo-traffic-moderate'];
            
            [...trafficLayers, ...demoLayers].forEach(layerId => {
                if (this.map.getLayer(layerId)) {
                    this.map.setLayoutProperty(layerId, 'visibility', 'none');
                }
            });

            this.isVisible = false;
        } catch (error) {
            console.error('Error hiding traffic layer:', error);
        }
    }

    _removeTrafficLayer() {
        if (!this.map) return;

        try {
            const trafficLayers = ['traffic-low', 'traffic-moderate', 'traffic-heavy', 'traffic-severe'];
            const demoLayers = ['demo-traffic-heavy', 'demo-traffic-moderate'];
            
            [...trafficLayers, ...demoLayers].forEach(layerId => {
                if (this.map.getLayer(layerId)) {
                    this.map.removeLayer(layerId);
                }
            });

            if (this.map.getSource('traffic')) {
                this.map.removeSource('traffic');
            }
            if (this.map.getSource('demo-traffic')) {
                this.map.removeSource('demo-traffic');
            }
        } catch (error) {
            console.error('Error removing traffic layer:', error);
        }
    }

    _updateButtonState() {
        if (this.button) {
            this.button.style.backgroundColor = this.isVisible ? '#4CAF50' : '';
            this.button.style.opacity = this.isVisible ? '1' : '0.6';
        }
    }

    // Public API methods for compatibility
    render() {
        if (this.isVisible) {
            this._showTraffic();
        } else {
            this._hideTraffic();
        }
    }

    isTrafficVisible() {
        return this.isVisible;
    }
}

export default TrackAsiaTrafficLayer;
