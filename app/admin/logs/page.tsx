'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Search,
  Download,
  RefreshCw,
  Terminal,
  Activity,
  FileText,
  XCircle,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'critical' | 'debug';
  category: 'auth' | 'api' | 'database' | 'system' | 'security' | 'performance';
  message: string;
  details?: string;
  userId?: string;
  username?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  statusCode?: number;
  duration?: number;
}

export default function LogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const checkAuth = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const fetchLogs = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/logs', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || generateMockLogs());
      } else if (response.status === 401 || response.status === 403) {
        router.push('/login');
      } else {
        // 임시 로그 데이터
        setLogs(generateMockLogs());
      }
    } catch {
      // Error handled - use mock data as fallback
      setLogs(generateMockLogs());
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
    void fetchLogs();
  }, [checkAuth, fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => void fetchLogs(), 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchLogs]);

  const generateMockLogs = (): LogEntry[] => {
    const levels: LogEntry['level'][] = ['info', 'warning', 'error', 'critical', 'debug'];
    const categories: LogEntry['category'][] = ['auth', 'api', 'database', 'system', 'security', 'performance'];
    const messages = [
      'User login successful',
      'Failed authentication attempt',
      'Database connection established',
      'API rate limit exceeded',
      'System backup completed',
      'Security scan initiated',
      'Performance threshold exceeded',
      'Cache cleared successfully',
      'File upload completed',
      'Session expired'
    ];

    return Array.from({ length: 50 }, (_, i) => ({
      id: `log-${i}`,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      level: levels[Math.floor(Math.random() * levels.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      details: Math.random() > 0.5 ? `Additional details for log entry ${i}` : undefined,
      userId: Math.random() > 0.5 ? `user-${Math.floor(Math.random() * 100)}` : undefined,
      username: Math.random() > 0.5 ? `user${Math.floor(Math.random() * 100)}` : undefined,
      ip: Math.random() > 0.5 ? `192.168.1.${Math.floor(Math.random() * 255)}` : undefined,
      endpoint: Math.random() > 0.5 ? `/api/${categories[Math.floor(Math.random() * categories.length)]}` : undefined,
      statusCode: Math.random() > 0.5 ? [200, 201, 400, 401, 403, 404, 500][Math.floor(Math.random() * 7)] : undefined,
      duration: Math.random() > 0.5 ? Math.floor(Math.random() * 1000) : undefined
    }));
  };

  const clearLogs = async () => {
    if (!confirm('정말로 선택한 로그를 삭제하시겠습니까?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/logs/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ logIds: selectedLogs }),
      });

      if (response.ok) {
        setSelectedLogs([]);
        fetchLogs();
      }
    } catch {
      // Error handled silently - clear logs operation failed
    }
  };

  const exportLogs = () => {
    const csvContent = `data:text/csv;charset=utf-8,` +
      `Timestamp,Level,Category,Message,User,IP,Endpoint,Status,Duration\n` +
      filteredLogs.map(log =>
        `"${log.timestamp}","${log.level}","${log.category}","${log.message}","${log.username || ''}","${log.ip || ''}","${log.endpoint || ''}","${log.statusCode || ''}","${log.duration || ''}"`
      ).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `logs_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-700" />;
      case 'debug':
        return <Terminal className="w-4 h-4 text-gray-500" />;
    }
  };

  const _getLevelBadgeVariant = (level: LogEntry['level']) => {
    switch (level) {
      case 'info':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'error':
        return 'destructive';
      case 'critical':
        return 'destructive';
      case 'debug':
        return 'outline';
    }
  };

  const getCategoryBadgeVariant = (category: LogEntry['category']) => {
    switch (category) {
      case 'auth':
        return 'default';
      case 'api':
        return 'secondary';
      case 'database':
        return 'outline';
      case 'system':
        return 'default';
      case 'security':
        return 'destructive';
      case 'performance':
        return 'secondary';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
    const matchesCategory = filterCategory === 'all' || log.category === filterCategory;

    return matchesSearch && matchesLevel && matchesCategory;
  });

  const logStats = {
    total: logs.length,
    info: logs.filter(l => l.level === 'info').length,
    warning: logs.filter(l => l.level === 'warning').length,
    error: logs.filter(l => l.level === 'error').length,
    critical: logs.filter(l => l.level === 'critical').length
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">시스템 로그</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            시스템 활동과 오류를 모니터링합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? 'default' : 'outline'}
          >
            <Activity className="w-4 h-4 mr-2" />
            {autoRefresh ? '자동 새로고침 ON' : '자동 새로고침 OFF'}
          </Button>
          <Button onClick={fetchLogs} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 로그</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">정보</CardTitle>
            <Info className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logStats.info}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">경고</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logStats.warning}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오류</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logStats.error}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">치명적</CardTitle>
            <XCircle className="h-4 w-4 text-red-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logStats.critical}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="메시지, 사용자, 상세 정보로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="레벨 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 레벨</SelectItem>
                <SelectItem value="info">정보</SelectItem>
                <SelectItem value="warning">경고</SelectItem>
                <SelectItem value="error">오류</SelectItem>
                <SelectItem value="critical">치명적</SelectItem>
                <SelectItem value="debug">디버그</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="카테고리 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 카테고리</SelectItem>
                <SelectItem value="auth">인증</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="database">데이터베이스</SelectItem>
                <SelectItem value="system">시스템</SelectItem>
                <SelectItem value="security">보안</SelectItem>
                <SelectItem value="performance">성능</SelectItem>
              </SelectContent>
            </Select>

            {selectedLogs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearLogs}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                선택 삭제 ({selectedLogs.length})
              </Button>
            )}

            <Button variant="outline" size="icon" onClick={exportLogs}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <input
                    type="checkbox"
                    checked={selectedLogs.length === filteredLogs.length && filteredLogs.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLogs(filteredLogs.map(l => l.id));
                      } else {
                        setSelectedLogs([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="w-[50px]">레벨</TableHead>
                <TableHead className="w-[150px]">시간</TableHead>
                <TableHead className="w-[100px]">카테고리</TableHead>
                <TableHead>메시지</TableHead>
                <TableHead className="w-[100px]">사용자</TableHead>
                <TableHead className="w-[100px]">상태</TableHead>
                <TableHead className="w-[80px]">소요시간</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <>
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedLogs.includes(log.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            setSelectedLogs([...selectedLogs, log.id]);
                          } else {
                            setSelectedLogs(selectedLogs.filter(id => id !== log.id));
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell>{getLevelIcon(log.level)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(log.timestamp), 'MM-dd HH:mm:ss')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getCategoryBadgeVariant(log.category)}>
                        {log.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md truncate">{log.message}</div>
                    </TableCell>
                    <TableCell>
                      {log.username && (
                        <div className="text-sm">
                          <div>{log.username}</div>
                          {log.ip && <div className="text-gray-500">{log.ip}</div>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.statusCode && (
                        <Badge variant={log.statusCode >= 400 ? 'destructive' : 'default'}>
                          {log.statusCode}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.duration && `${log.duration}ms`}
                    </TableCell>
                  </TableRow>
                  {expandedLog === log.id && (log.details || log.endpoint || log.userAgent) && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-gray-50 dark:bg-gray-800">
                        <div className="p-4 space-y-2">
                          {log.details && (
                            <div>
                              <span className="font-medium">상세 정보:</span> {log.details}
                            </div>
                          )}
                          {log.endpoint && (
                            <div>
                              <span className="font-medium">엔드포인트:</span> {log.endpoint}
                            </div>
                          )}
                          {log.userAgent && (
                            <div>
                              <span className="font-medium">User Agent:</span> {log.userAgent}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>

          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              로그가 없습니다.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}