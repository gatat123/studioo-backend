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
  Folder,
  Search,
  Users,
  Eye,
  Trash2,
  Archive,
  Settings,
  FileText,
  Image,
  RefreshCw,
  TrendingUp,
  Clock
} from 'lucide-react';
import { safeFormat, safeGetTime } from '@/lib/utils/date-helpers';

interface Project {
  id: string;
  title: string;
  description: string;
  owner: {
    id: string;
    username: string;
  };
  status: 'active' | 'archived' | 'deleted';
  visibility: 'public' | 'private';
  collaborators: number;
  scenes: number;
  assets: number;
  lastUpdated: string;
  createdAt: string;
  views: number;
  size: number; // in MB
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('lastUpdated');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const checkAuth = () => {
    // Set temporary token for gatat123 if not exists
    if (!localStorage.getItem('token')) {
      localStorage.setItem('token', 'gatat123-temp-token');
      localStorage.setItem('username', 'gatat123');
      localStorage.setItem('userId', 'gatat123-temp-id');
    }
  };

  const fetchProjects = useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || 'gatat123-temp-token';
      const response = await fetch('/api/admin/projects', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      } else if (response.status === 401 || response.status === 403) {
        router.push('/login');
      }
    } catch {
      // Error handled - fetch projects failed
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
    fetchProjects().catch(() => {
      // Error handling is already done in fetchProjects
    });
  }, [fetchProjects]);

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token') || 'gatat123-temp-token';
      const response = await fetch(`/api/admin/projects/${projectId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchProjects();
      }
    } catch {
      // Status update failed - error handled silently
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('정말로 이 프로젝트를 삭제하시겠습니까?')) return;

    try {
      const token = localStorage.getItem('token') || 'gatat123-temp-token';
      const response = await fetch(`/api/admin/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchProjects();
      }
    } catch {
      // Project deletion failed - error handled silently
    }
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const filteredProjects = projects
    .filter(project => {
      const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           project.owner.username.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'lastUpdated':
          return safeGetTime(b.lastUpdated) - safeGetTime(a.lastUpdated);
        case 'created':
          return safeGetTime(b.createdAt) - safeGetTime(a.createdAt);
        case 'views':
          return b.views - a.views;
        case 'size':
          return b.size - a.size;
        default:
          return 0;
      }
    });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'archived':
        return 'secondary';
      case 'deleted':
        return 'destructive';
      default:
        return 'default';
    }
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">프로젝트 관리</h1>
          <p className="text-gray-600 dark:text-gray-600 mt-2">
            모든 프로젝트를 관리하고 모니터링합니다.
          </p>
        </div>
        <Button onClick={fetchProjects} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 프로젝트</CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 프로젝트</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projects.filter(p => p.status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 조회수</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projects.reduce((sum, p) => sum + p.views, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 용량</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(projects.reduce((sum, p) => sum + p.size, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 w-4 h-4" />
              <Input
                placeholder="프로젝트명 또는 소유자로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="상태 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 상태</SelectItem>
                <SelectItem value="active">활성</SelectItem>
                <SelectItem value="archived">보관됨</SelectItem>
                <SelectItem value="deleted">삭제됨</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="정렬 기준" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lastUpdated">최근 업데이트</SelectItem>
                <SelectItem value="created">생성일</SelectItem>
                <SelectItem value="views">조회수</SelectItem>
                <SelectItem value="size">용량</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Image className="w-4 h-4" aria-label="Grid view" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <FileText className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Projects Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{project.title}</CardTitle>
                    <p className="text-sm text-gray-700 mt-1">by {project.owner.username}</p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(project.status)}>
                    {project.status === 'active' ? '활성' :
                     project.status === 'archived' ? '보관됨' : '삭제됨'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-600 line-clamp-2">
                  {project.description || '설명 없음'}
                </p>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{project.collaborators} 협업자</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>{project.scenes} 씬</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    <span>{project.views.toLocaleString()} 조회</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Archive className="w-3 h-3" />
                    <span>{formatFileSize(project.size)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-700">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {safeFormat(project.lastUpdated, 'yyyy-MM-dd')}
                  </div>
                  <Badge variant={project.visibility === 'public' ? 'outline' : 'secondary'}>
                    {project.visibility === 'public' ? '공개' : '비공개'}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push(`/studio/projects/${project.id}`)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    보기
                  </Button>
                  {project.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleStatusChange(project.id, 'archived')}
                    >
                      <Archive className="w-3 h-3 mr-1" />
                      보관
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleStatusChange(project.id, 'active')}
                    >
                      복원
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteProject(project.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-4">프로젝트</th>
                  <th className="text-left p-4">소유자</th>
                  <th className="text-left p-4">상태</th>
                  <th className="text-left p-4">협업자</th>
                  <th className="text-left p-4">씬</th>
                  <th className="text-left p-4">조회수</th>
                  <th className="text-left p-4">용량</th>
                  <th className="text-left p-4">업데이트</th>
                  <th className="text-right p-4">작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{project.title}</div>
                        <div className="text-sm text-gray-700">{project.description?.substring(0, 50)}...</div>
                      </div>
                    </td>
                    <td className="p-4">{project.owner.username}</td>
                    <td className="p-4">
                      <Badge variant={getStatusBadgeVariant(project.status)}>
                        {project.status === 'active' ? '활성' :
                         project.status === 'archived' ? '보관됨' : '삭제됨'}
                      </Badge>
                    </td>
                    <td className="p-4">{project.collaborators}</td>
                    <td className="p-4">{project.scenes}</td>
                    <td className="p-4">{project.views.toLocaleString()}</td>
                    <td className="p-4">{formatFileSize(project.size)}</td>
                    <td className="p-4">
                      {safeFormat(project.lastUpdated, 'yyyy-MM-dd')}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost">
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteProject(project.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {filteredProjects.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-700">검색 결과가 없습니다.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}