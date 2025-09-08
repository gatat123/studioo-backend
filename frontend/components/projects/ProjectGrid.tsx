'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Grid3X3, List, Plus, Calendar, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';

interface Project {
  id: string;
  name: string;
  description?: string;
  deadline?: Date | string;
  tag?: 'illustration' | 'storyboard';
  status: 'active' | 'completed' | 'archived';
  hasUpdates: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  thumbnail?: string;
}

export function ProjectGrid() {
  const router = useRouter();
  const { projects, isLoading, fetchProjects } = useProjectStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<'all' | 'illustration' | 'storyboard'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'archived'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'deadline'>('date');
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Handle project click
  const handleProjectClick = (projectId: string) => {
    router.push(`/studio/projects/${projectId}`);
  };

  // Load projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Filter and sort projects
  useEffect(() => {
    let filtered = [...projects];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply tag filter
    if (filterTag !== 'all') {
      filtered = filtered.filter(project => project.tag === filterTag);
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(project => project.status === filterStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'deadline':
          const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          return aDeadline - bDeadline;
        case 'date':
        default:
          const aUpdated = new Date(a.updatedAt).getTime();
          const bUpdated = new Date(b.updatedAt).getTime();
          return bUpdated - aUpdated;
      }
    });

    setFilteredProjects(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [projects, searchQuery, filterTag, filterStatus, sortBy]);

  // Paginate projects
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Format deadline
  const formatDeadline = (deadline?: Date | string) => {
    if (!deadline) return null;
    const now = new Date();
    const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: '마감 지남', className: 'text-red-600 bg-red-50' };
    if (diffDays === 0) return { text: '오늘 마감', className: 'text-orange-600 bg-orange-50' };
    if (diffDays <= 3) return { text: `${diffDays}일 남음`, className: 'text-orange-600 bg-orange-50' };
    if (diffDays <= 7) return { text: `${diffDays}일 남음`, className: 'text-yellow-600 bg-yellow-50' };
    return { text: `${diffDays}일 남음`, className: 'text-gray-600 bg-gray-50' };
  };

  // Loading skeleton
  const ProjectSkeleton = () => (
    <div className="space-y-3">
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );

  // Empty state
  const EmptyState = () => (
    <div className="col-span-full flex flex-col items-center justify-center py-12">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <Grid3X3 className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">프로젝트가 없습니다</h3>
      <p className="text-sm text-gray-500 mb-6">
        {searchQuery || filterTag !== 'all' || filterStatus !== 'all'
          ? '검색 조건에 맞는 프로젝트가 없습니다.'
          : '첫 프로젝트를 생성해보세요!'}
      </p>
      {!searchQuery && filterTag === 'all' && filterStatus === 'all' && (
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          새 프로젝트
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="프로젝트 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters and View Options */}
        <div className="flex gap-2">
          {/* Tag Filter */}
          <Select value={filterTag} onValueChange={(value: any) => setFilterTag(value)}>
            <SelectTrigger className="w-[140px]">
              <Tag className="h-4 w-4 mr-2" />
              <SelectValue placeholder="태그" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="illustration">일러스트</SelectItem>
              <SelectItem value="storyboard">스토리보드</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default">
                <Filter className="h-4 w-4 mr-2" />
                상태
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>프로젝트 상태</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filterStatus === 'all'}
                onCheckedChange={() => setFilterStatus('all')}
              >
                전체
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterStatus === 'active'}
                onCheckedChange={() => setFilterStatus('active')}
              >
                진행중
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterStatus === 'completed'}
                onCheckedChange={() => setFilterStatus('completed')}
              >
                완료
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterStatus === 'archived'}
                onCheckedChange={() => setFilterStatus('archived')}
              >
                보관
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">최근 수정</SelectItem>
              <SelectItem value="name">이름순</SelectItem>
              <SelectItem value="deadline">마감일순</SelectItem>
            </SelectContent>
          </Select>

          {/* View Mode Toggle */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Projects Grid/List */}
      {isLoading ? (
        <div className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
        )}>
          {[...Array(6)].map((_, i) => (
            <ProjectSkeleton key={i} />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
        )}>
          {paginatedProjects.map((project) => {
            const deadline = formatDeadline(project.deadline);
            
            return viewMode === 'grid' ? (
              // Grid View Card
              <div
                key={project.id}
                className="group relative bg-white rounded-lg border hover:shadow-lg transition-all cursor-pointer"
                onClick={() => handleProjectClick(project.id)}
              >
                {project.hasUpdates && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                  </div>
                )}
                
                <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
                  {project.thumbnail ? (
                    <img
                      src={project.thumbnail}
                      alt={project.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Grid3X3 className="h-12 w-12 text-gray-300" />
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 truncate mb-1">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {project.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {project.tag && (
                        <Badge variant="outline" className="text-xs">
                          {project.tag === 'illustration' ? '일러스트' : '스토리보드'}
                        </Badge>
                      )}
                    </div>
                    
                    {deadline && (
                      <Badge className={cn('text-xs', deadline.className)}>
                        <Calendar className="h-3 w-3 mr-1" />
                        {deadline.text}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // List View Item
              <div
                key={project.id}
                className="group relative bg-white rounded-lg border hover:shadow-md transition-all cursor-pointer p-4"
                onClick={() => handleProjectClick(project.id)}
              >
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-24 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                    {project.thumbnail ? (
                      <img
                        src={project.thumbnail}
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Grid3X3 className="h-6 w-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {project.name}
                      </h3>
                      {project.hasUpdates && (
                        <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse ml-2" />
                      )}
                    </div>
                    {project.description && (
                      <p className="text-sm text-gray-600 line-clamp-1 mb-2">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      {project.tag && (
                        <Badge variant="outline" className="text-xs">
                          {project.tag === 'illustration' ? '일러스트' : '스토리보드'}
                        </Badge>
                      )}
                      <Badge
                        variant={project.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {project.status === 'active' ? '진행중' :
                         project.status === 'completed' ? '완료' : '보관'}
                      </Badge>
                      {deadline && (
                        <Badge className={cn('text-xs', deadline.className)}>
                          <Calendar className="h-3 w-3 mr-1" />
                          {deadline.text}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && filteredProjects.length > itemsPerPage && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          className="mt-8"
        />
      )}
    </div>
  );
}
