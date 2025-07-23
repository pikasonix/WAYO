import { useState, useCallback, useRef } from 'react';

export function useMapControls() {
  const [useRealRouting, setUseRealRouting] = useState(false);
  const routingCacheRef = useRef(new Map());

  const generateCacheKey = useCallback(
    (start, end) => `${start[0].toFixed(6)},${start[1].toFixed(6)}-${end[0].toFixed(6)},${end[1].toFixed(6)}`,
    []
  );

  const loadCacheFromStorage = useCallback(() => {
    try {
      const cached = localStorage.getItem('pdptw_routing_cache');
      if (cached) routingCacheRef.current = new Map(JSON.parse(cached));
    } catch { routingCacheRef.current = new Map(); }
  }, []);

  const saveCacheToStorage = useCallback(() => {
    try {
      localStorage.setItem('pdptw_routing_cache', JSON.stringify(Array.from(routingCacheRef.current.entries())));
    } catch { }
  }, []);

  const getCacheStats = useCallback(() => {
    const cacheSize = routingCacheRef.current.size;
    let storageSize = 0;
    try {
      const cached = localStorage.getItem('pdptw_routing_cache');
      storageSize = cached ? (cached.length * 2) / 1024 : 0;
    } catch { }
    return { entries: cacheSize, sizeKB: storageSize.toFixed(1) };
  }, []);

  const showCacheInfo = useCallback(() => {
    const stats = getCacheStats();
    const cacheSize = (JSON.stringify(Array.from(routingCacheRef.current.entries())).length / 1024).toFixed(2);
    alert(
      `Thông tin Cache:\n• Số tuyến đường đã lưu: ${stats.entries}\n• Kích thước cache: ${cacheSize} KB\n• Cache trong localStorage: ${localStorage.getItem('pdptw_routing_cache') ? 'Có' : 'Không'}`
    );
  }, [getCacheStats]);

  const clearRoutingCache = useCallback(() => {
    routingCacheRef.current.clear();
    localStorage.removeItem('pdptw_routing_cache');
  }, []);

  const toggleRealRouting = useCallback(() => setUseRealRouting(v => !v), []);

  return {
    useRealRouting,
    setUseRealRouting,
    routingCacheRef,
    generateCacheKey,
    loadCacheFromStorage,
    saveCacheToStorage,
    getCacheStats,
    showCacheInfo,
    clearRoutingCache,
    toggleRealRouting,
  };
}