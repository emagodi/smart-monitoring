import { useEffect, useState } from 'react';

interface SensorUpdate {
  type: string;
  sensor_id: number;
  sensor_name: string;
  sensor_type: string;
  transformer_id: number;
  transformer_name: string;
  depot_name: string;
  region_name: string;
  value: number | string;
  is_alert: boolean;
  timestamp: number;
}

interface RealtimeServiceCallbacks {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
  onSensorUpdate?: (update: SensorUpdate) => void;
}

class RealtimeService {
  private eventSource: EventSource | null = null;
  private callbacks: RealtimeServiceCallbacks = {};
  private baseUrl: string;
  private transformerPrefix: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    this.transformerPrefix = import.meta.env.VITE_TRANSFORMER_SERVICE_PREFIX || '/transformer-service';
  }

  public connect(token: string, callbacks: RealtimeServiceCallbacks): void {
    if (this.eventSource) {
      this.disconnect();
    }

    this.token = token;
    this.callbacks = callbacks;

    // Using a workaround since EventSource doesn't support custom headers
    // We'll pass the token as a query parameter
    const streamUrl = `${this.baseUrl}/api/realtime/stream/?token=${encodeURIComponent(token)}`;

    // Create the event source with the proper URL
    const eventSource = new EventSource(streamUrl, {
      withCredentials: true  // This ensures cookies are sent for authentication
    });

    // Set the Authorization header via custom headers is not supported by EventSource,
    // so we'll make sure our backend accepts token via query parameter
    this.eventSource = eventSource;

    this.eventSource.onopen = () => {
      console.log('Connected to real-time sensor stream');
      if (this.callbacks.onConnect) {
        this.callbacks.onConnect();
      }
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.callbacks.onSensorUpdate) {
          this.callbacks.onSensorUpdate(data);
        }
      } catch (error) {
        console.error('Error parsing real-time data:', error);
        if (this.callbacks.onError) {
          this.callbacks.onError(error);
        }
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('Real-time stream error:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    };
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('Disconnected from real-time sensor stream');
      if (this.callbacks.onDisconnect) {
        this.callbacks.onDisconnect();
      }
    }
  }

  public isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }

  // Method to fetch latest sensor readings if SSE connection fails
  public async fetchLatestReadings(token: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}${this.transformerPrefix}/realtime/latest/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching latest readings:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const realtimeService = new RealtimeService();

// React hook for using real-time updates in components
export const useRealtimeUpdates = (token: string | null) => {
  const [realtimeData, setRealtimeData] = useState<SensorUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    const callbacks: RealtimeServiceCallbacks = {
      onConnect: () => {
        setIsConnected(true);
        setConnectionError(null);
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onError: (error) => {
        setConnectionError(error.toString());
        setIsConnected(false);
      },
      onSensorUpdate: (update) => {
        // Update the local state with the new sensor data
        setRealtimeData(prevData => {
          // Find existing sensor data with the same ID to update
          const existingIndex = prevData.findIndex(item => item.sensor_id === update.sensor_id);
          
          if (existingIndex !== -1) {
            // Update existing sensor data
            const newData = [...prevData];
            newData[existingIndex] = update;
            return newData;
          } else {
            // Add new sensor data
            return [...prevData, update];
          }
        });
      }
    };

    realtimeService.connect(token, callbacks);

    // Cleanup function to disconnect when component unmounts
    return () => {
      realtimeService.disconnect();
    };
  }, [token]);

  return {
    realtimeData,
    isConnected,
    connectionError,
    fetchLatestReadings: () => token ? realtimeService.fetchLatestReadings(token) : Promise.reject('No token'),
  };
};