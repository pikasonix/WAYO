class TrafficAPIService {
    constructor() {
        this.mapboxToken = process.env.VITE_MAPBOX_ACCESS_TOKEN;
        this.trackAsiaApiUrl = process.env.VITE_TRACK_ASIA_API_KEY;
    }

    async getTrafficData(bounds) {
        try {
            const trafficSources = [];
            if (this.mapboxToken) {
                trafficSources.push(this.getMapboxTrafficData(bounds));
            }
            if (this.trackAsiaApiUrl) {
                trafficSources.push(this.getTrackAsiaTrafficData(bounds));
            }
            const results = await Promise.allSettled(trafficSources);
            const successfulResults = results
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value)
                .filter(data => data && data.length > 0);
            if (successfulResults.length > 0) {
                return successfulResults.flat();
            } else {
                return [];
            }
        } catch (error) {
            return [];
        }
    }

    async getMapboxTrafficData(bounds) {
        if (!this.mapboxToken) {
            return [];
        }
        try {
            const response = await fetch(
                `https://api.mapbox.com/traffic/v1/traffic-tiles?access_token=${this.mapboxToken}`
            );
            if (!response.ok) {
                throw new Error('Failed to fetch Mapbox traffic data');
            }
            return await response.json();
        } catch (error) {
            return [];
        }
    }

    async getTrackAsiaTrafficData(bounds) {
        if (!this.trackAsiaApiUrl) {
            return [];
        }
        try {
            const response = await fetch(
                `${this.trackAsiaApiUrl}/traffic?bounds=${bounds.join(',')}`
            );
            if (!response.ok) {
                throw new Error('Failed to fetch TrackAsia traffic data');
            }
            return await response.json();
        } catch (error) {
            return [];
        }
    }
}

export default new TrafficAPIService();
