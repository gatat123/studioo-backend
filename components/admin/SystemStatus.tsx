'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  Database,
  Server,
  Wifi,
  HardDrive,
  Activity
} from 'lucide-react';

interface SystemMetric {
  name: string;
  value: number;
  max: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  icon: React.ReactNode;
}

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  latency?: number;
  lastChecked: string;
}

export default function SystemStatus() {
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSystemStatus = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');

        if (!token) {
          console.warn('No authentication token found for system status');
          setMetrics(getDefaultMetrics());
          setServices(getDefaultServices());
          setIsLoading(false);
          return;
        }

        const response = await fetch('/api/admin/system/status', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setMetrics(data.metrics || getDefaultMetrics());
          setServices(data.services || getDefaultServices());
        } else {
          console.error('Failed to fetch system status:', response.status);
          // Use default data if API fails
          setMetrics(getDefaultMetrics());
          setServices(getDefaultServices());
        }
      } catch (error) {
        console.error('Error fetching system status:', error);
        // Use default data
        setMetrics(getDefaultMetrics());
        setServices(getDefaultServices());
      } finally {
        setIsLoading(false);
      }
    };

    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getDefaultMetrics = (): SystemMetric[] => [
    {
      name: 'CPU 사용률',
      value: 45,
      max: 100,
      unit: '%',
      status: 'healthy',
      icon: <Activity className="w-4 h-4" />,
    },
    {
      name: '메모리 사용량',
      value: 3.2,
      max: 8,
      unit: 'GB',
      status: 'healthy',
      icon: <Server className="w-4 h-4" />,
    },
    {
      name: '디스크 사용량',
      value: 124,
      max: 500,
      unit: 'GB',
      status: 'healthy',
      icon: <HardDrive className="w-4 h-4" />,
    },
    {
      name: '네트워크 트래픽',
      value: 2.5,
      max: 10,
      unit: 'Mbps',
      status: 'healthy',
      icon: <Wifi className="w-4 h-4" />,
    },
  ];

  const getDefaultServices = (): ServiceStatus[] => [
    {
      name: '데이터베이스',
      status: 'online',
      latency: 12,
      lastChecked: new Date().toISOString(),
    },
    {
      name: '파일 스토리지',
      status: 'online',
      latency: 45,
      lastChecked: new Date().toISOString(),
    },
    {
      name: '실시간 서버',
      status: 'online',
      latency: 8,
      lastChecked: new Date().toISOString(),
    },
    {
      name: '백업 서비스',
      status: 'online',
      latency: 120,
      lastChecked: new Date().toISOString(),
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-slate-600" />;
      case 'offline':
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-100 text-green-800">온라인</Badge>;
      case 'offline':
        return <Badge className="bg-red-100 text-red-800">오프라인</Badge>;
      case 'degraded':
        return <Badge className="bg-slate-100 text-slate-800">성능 저하</Badge>;
      default:
        return null;
    }
  };

  // Removed unused getMetricColor function
  // const getMetricColor = (status: string) => {
  //   switch (status) {
  //     case 'healthy':
  //       return 'bg-green-500';
  //     case 'warning':
  //       return 'bg-slate-500';
  //     case 'critical':
  //       return 'bg-red-500';
  //     default:
  //       return 'bg-gray-500';
  //   }
  // };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Metrics */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          시스템 리소스
        </h3>
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div key={metric.name}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {metric.icon}
                  <span className="text-sm text-gray-600 dark:text-gray-600">
                    {metric.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {metric.value}{metric.unit} / {metric.max}{metric.unit}
                  </span>
                  {getStatusIcon(metric.status)}
                </div>
              </div>
              <Progress
                value={(metric.value / metric.max) * 100}
                className="h-2"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Service Status */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          서비스 상태
        </h3>
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-gray-700" />
                <span className="text-sm font-medium">{service.name}</span>
              </div>
              <div className="flex items-center gap-4">
                {service.latency && (
                  <span className="text-xs text-gray-700">
                    {service.latency}ms
                  </span>
                )}
                {getStatusBadge(service.status)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Last Update */}
      <div className="text-xs text-gray-700 text-right">
        마지막 업데이트: {new Date().toLocaleTimeString('ko-KR')}
      </div>
    </div>
  );
}