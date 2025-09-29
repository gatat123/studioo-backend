'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Briefcase,
  CheckSquare,
  Clock,
  Users,
  Trash2,
  Search,
  Filter,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from '@/lib/utils/time-format';

interface WorkTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    username: string;
    nickname: string;
    profileImageUrl?: string;
  };
  participants: Array<{
    user: {
      id: string;
      username: string;
      nickname: string;
      profileImageUrl?: string;
    };
  }>;
  _count: {
    subTasks: number;
    comments: number;
  };
}

interface SubTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  lastModifiedAt: string;
  timeSinceLastModified: number;
  workTask: {
    id: string;
    title: string;
  };
  assignee?: {
    id: string;
    nickname: string;
    profileImageUrl?: string;
  };
  createdBy: {
    id: string;
    nickname: string;
    profileImageUrl?: string;
  };
  participants: Array<{
    user: {
      id: string;
      nickname: string;
      profileImageUrl?: string;
    };
  }>;
  _count: {
    comments: number;
    attachments: number;
  };
}

interface WorkStats {
  totalWorkTasks: number;
  totalSubTasks: number;
  completedSubTasks: number;
  inProgressSubTasks: number;
  pendingSubTasks: number;
  urgentTasks: number;
}

export default function AdminWorkPage() {
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [stats, setStats] = useState<WorkStats>({
    totalWorkTasks: 0,
    totalSubTasks: 0,
    completedSubTasks: 0,
    inProgressSubTasks: 0,
    pendingSubTasks: 0,
    urgentTasks: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  useEffect(() => {
    fetchWorkData();
  }, [statusFilter, priorityFilter]);

  const fetchWorkData = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');

      if (!token) {
        setIsLoading(false);
        return;
      }

      const params = new URLSearchParams({
        type: 'all',
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(priorityFilter !== 'all' && { priority: priorityFilter }),
      });

      const response = await fetch(`/api/admin/work?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setWorkTasks(data.workTasks || []);
        setSubTasks(data.subTasks || []);

        // Calculate stats
        const totalWorkTasks = data.workTasks?.length || 0;
        const totalSubTasks = data.subTasks?.length || 0;
        const completedSubTasks = data.subTasks?.filter((st: SubTask) => st.status === 'done').length || 0;
        const inProgressSubTasks = data.subTasks?.filter((st: SubTask) => st.status === 'in_progress').length || 0;
        const pendingSubTasks = data.subTasks?.filter((st: SubTask) => st.status === 'todo').length || 0;
        const urgentTasks = [...(data.workTasks || []), ...(data.subTasks || [])].filter((task: any) => task.priority === 'urgent').length;

        setStats({
          totalWorkTasks,
          totalSubTasks,
          completedSubTasks,
          inProgressSubTasks,
          pendingSubTasks,
          urgentTasks,
        });
      }
    } catch (error) {
      console.error('Failed to fetch work data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorkTask = async (id: string, type: 'work-task' | 'sub-task') => {
    if (!confirm(`정말로 이 ${type === 'work-task' ? '업무' : '세부 작업'}을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/work?type=${type}&id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        await fetchWorkData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to delete work item:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: '대기중', className: 'bg-gray-100 text-gray-700' },
      todo: { label: '할일', className: 'bg-gray-100 text-gray-700' },
      in_progress: { label: '진행중', className: 'bg-blue-100 text-blue-700' },
      review: { label: '검토중', className: 'bg-yellow-100 text-yellow-700' },
      done: { label: '완료', className: 'bg-green-100 text-green-700' },
      completed: { label: '완료', className: 'bg-green-100 text-green-700' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, className: 'bg-gray-100 text-gray-700' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { label: '낮음', className: 'bg-green-100 text-green-700' },
      medium: { label: '보통', className: 'bg-blue-100 text-blue-700' },
      high: { label: '높음', className: 'bg-orange-100 text-orange-700' },
      urgent: { label: '긴급', className: 'bg-red-100 text-red-700' },
    };

    const config = priorityConfig[priority as keyof typeof priorityConfig] || { label: priority, className: 'bg-gray-100 text-gray-700' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const filteredWorkTasks = workTasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubTasks = subTasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.workTask.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Work 관리</h1>
        <p className="text-gray-700 dark:text-gray-300 mt-2">
          모든 업무와 세부 작업을 관리하고 모니터링합니다.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 업무</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWorkTasks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">세부 작업</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubTasks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">완료된 작업</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedSubTasks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">진행중</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgressSubTasks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">대기중</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingSubTasks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">긴급 작업</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.urgentTasks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="상태 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 상태</SelectItem>
                <SelectItem value="todo">할일</SelectItem>
                <SelectItem value="in_progress">진행중</SelectItem>
                <SelectItem value="review">검토중</SelectItem>
                <SelectItem value="done">완료</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="우선순위 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 우선순위</SelectItem>
                <SelectItem value="low">낮음</SelectItem>
                <SelectItem value="medium">보통</SelectItem>
                <SelectItem value="high">높음</SelectItem>
                <SelectItem value="urgent">긴급</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="work-tasks">업무 목록</TabsTrigger>
          <TabsTrigger value="sub-tasks">세부 작업</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Work Tasks */}
            <Card>
              <CardHeader>
                <CardTitle>최근 업무</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {workTasks.slice(0, 5).map((task) => (
                      <div key={task.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={task.createdBy.profileImageUrl} />
                          <AvatarFallback>
                            {task.createdBy.nickname.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-gray-500">
                            {task.createdBy.nickname} • {formatDistanceToNow(task.createdAt)}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          {getStatusBadge(task.status)}
                          {getPriorityBadge(task.priority)}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Recent Sub Tasks */}
            <Card>
              <CardHeader>
                <CardTitle>최근 세부 작업</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {subTasks.slice(0, 5).map((task) => (
                      <div key={task.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={task.createdBy.profileImageUrl} />
                          <AvatarFallback>
                            {task.createdBy.nickname.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-gray-500">
                            {task.workTask.title} • {formatDistanceToNow(task.lastModifiedAt)}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          {getStatusBadge(task.status)}
                          {getPriorityBadge(task.priority)}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="work-tasks">
          <Card>
            <CardHeader>
              <CardTitle>업무 목록</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>제목</TableHead>
                    <TableHead>생성자</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>우선순위</TableHead>
                    <TableHead>참여자</TableHead>
                    <TableHead>세부 작업</TableHead>
                    <TableHead>생성일</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{task.createdBy.nickname}</TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      <TableCell>{task.participants.length}명</TableCell>
                      <TableCell>{task._count.subTasks}개</TableCell>
                      <TableCell>{formatDistanceToNow(task.createdAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteWorkTask(task.id, 'work-task')}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sub-tasks">
          <Card>
            <CardHeader>
              <CardTitle>세부 작업 목록</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>제목</TableHead>
                    <TableHead>상위 업무</TableHead>
                    <TableHead>담당자</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>우선순위</TableHead>
                    <TableHead>마지막 수정</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{task.workTask.title}</TableCell>
                      <TableCell>
                        {task.assignee ? (
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={task.assignee.profileImageUrl} />
                              <AvatarFallback>
                                {task.assignee.nickname.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{task.assignee.nickname}</span>
                          </div>
                        ) : (
                          '미할당'
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      <TableCell>{formatDistanceToNow(task.lastModifiedAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteWorkTask(task.id, 'sub-task')}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}