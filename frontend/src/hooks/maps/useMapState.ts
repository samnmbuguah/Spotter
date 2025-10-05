import { useState, useCallback } from 'react';

type PointType = 'origin' | 'pickup' | 'destination';

export interface MapPoint {
  lat: number;
  lng: number;
  address?: string;
  type: PointType;
  id: string;
  timestamp: number;
}

export interface Directions {
  route?: google.maps.DirectionsResult;
  loading: boolean;
  error: string | null;
}

interface MapState {
  points: MapPoint[];
  directions: Directions;
  selectedPoint: MapPoint | null;
  addPoint: (lat: number, lng: number, type: PointType) => Promise<void>;
  removePoint: (id: string) => void;
  updatePoint: (id: string, updates: Partial<MapPoint>) => void;
  setSelectedPoint: (point: MapPoint | null) => void;
  clearPoints: () => void;
  setDirections: (directions: Partial<Directions>) => void;
}

export const useMapState = (): MapState => {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [directions, setDirections] = useState<Directions>({
    loading: false,
    error: null,
  });

  const addPoint = useCallback(async (lat: number, lng: number, type: PointType) => {
    const newPoint: MapPoint = {
      lat,
      lng,
      type,
      id: `${type}-${Date.now()}`,
      timestamp: Date.now(),
    };

    setPoints(prev => {
      // Remove any existing point of the same type
      const filtered = prev.filter(p => p.type !== type);
      return [...filtered, newPoint];
    });

    setSelectedPoint(newPoint);
  }, []);

  const removePoint = useCallback((id: string) => {
    setPoints(prev => prev.filter(point => point.id !== id));
    setSelectedPoint(prev => (prev?.id === id ? null : prev));
  }, []);

  const updatePoint = useCallback((id: string, updates: Partial<MapPoint>) => {
    setPoints(prev =>
      prev.map(point =>
        point.id === id ? { ...point, ...updates } : point
      )
    );
    setSelectedPoint(prev => (prev?.id === id ? { ...prev, ...updates } : prev));
  }, []);

  const clearPoints = useCallback(() => {
    setPoints([]);
    setSelectedPoint(null);
    setDirections({ loading: false, error: null });
  }, []);

  const updateDirections = useCallback((updates: Partial<Directions>) => {
    setDirections(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  return {
    points,
    selectedPoint,
    directions,
    addPoint,
    removePoint,
    updatePoint,
    setSelectedPoint,
    clearPoints,
    setDirections: updateDirections,
  };
};

export default useMapState;
