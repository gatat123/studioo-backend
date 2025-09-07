'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  MoreHorizontal, 
  Folder,
  Users,
  Calendar,
  Eye,
  Archive,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  creator: string;
  participants: number;
  status: 'active' | 'completed' | 'archived';
  type: 'illustration' | 'storyboard';
  deadline: string;
  progress: number;
  createdAt: string;
  lastActivity: string;
}

// Mock data
const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Summer Campaign Illustrations',
    creator: 'john_doe',
    participants: 5,
    status: 'active',
    type: 'illustration',
    deadline: '2024-02-01T00:00:00Z',
    progress: 75,
    createdAt: '2024-01-01T00:00:00Z',
    lastActivity: '2024-01-15T14:30:00Z'
  },
  {
    id: '2',
    name: 'Product Launch Storyboard',
    creator: 'jane_smith',
    participants: 3,
    status: 'active',
    type: 'storyboard',
    deadline: '2024-01-25T00:00:00Z',
    progress: 45,
    createdAt: '2024-01-05T00:00:00Z',
    lastActivity: '2024-01-15T10:00:00Z'
  },
  {
    id: '3',
    name: 'Holiday Season Assets',
    creator: 'alice_brown',
    participants: 8,
    status: 'completed',
    type: 'illustration',
    deadline: '2023-12-20T00:00:00Z',
    progress: 100,
    createdAt: '2023-11-01T00:00:00Z',
    lastActivity: '2023-12-20T16:45:00Z'
  },
  {
    id: '4',
    name: 'Training Video Storyboard',
    creator: 'bob_wilson',
    participants: 2,
    status: 'archived',
    type: 'storyboard',
    deadline: '2023-10-15T00:00:00Z',
    progress: 100,
    createdAt: '2023-09-01T00:00:00Z',
    lastActivity: '2023-10-15T09:30:00Z'
  },
  {
    id: '5',
    name: 'Brand Refresh Concepts',
    creator: 'john_doe',
    participants: 6,
    status: 'active',
    type: 'illustration',
    deadline: '2024-03-01T00:00:00Z',
    progress: 30,
    createdAt: '2024-01-10T00:00:00Z',
    lastActivity: '2024-01-14T11:20:00Z'
  }
];

export default function ProjectManagement() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('lastActivity');

  useEffect(() => {
    // Load mock data
    setProjects(mockProjects);
  }, []);

  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.creator.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesType = typeFilter === 'all' || project.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'deadline':
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      case 'progress':
        return b.progress - a.progress;
      case 'lastActivity':
      default:
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    }
  });

  const handleStatusChange = (projectId: string, newStatus: 'active' | 'completed' | 'archived') => {
    setProjects(prev => prev.map(project => 
      project.id === projectId ? { ...project, status: newStatus } : project
    ));
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      setProjects(prev => prev.filter(project => project.id !== projectId));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800">
            <Clock className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'archived':
        return (
          <Badge className="bg-gray-100 text-gray-800">
            <Archive className="h-3 w-3 mr-1" />
            Archived
          </Badge>
        );
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'illustration':
        return <Badge className="bg-purple-100 text-purple-800">Illustration</Badge>;
      case 'storyboard':
        return <Badge className="bg-orange-100 text-orange-800">Storyboard</Badge>;
      default:
        return null;
    }
  };

  const getDeadlineStatus = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDeadline < 0) {
      return <span className="text-red-600 flex items-center"><AlertCircle className="h-3 w-3 mr-1" />Overdue</span>;
    } else if (daysUntilDeadline <= 7) {
      return <span className="text-orange-600 flex items-center"><AlertCircle className="h-3 w-3 mr-1" />{daysUntilDeadline}d left</span>;
    } else {
      return <span className="text-gray-600">{deadlineDate.toLocaleDateString()}</span>;
    }
  };

  // Statistics
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    archived: projects.filter(p => p.status === 'archived').length
  };

  return (
    <div className="space-y-6">
      {/* Header and Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Project Management</h2>
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-sm text-gray-500">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
            <div className="text-sm text-gray-500">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.archived}</div>
            <div className="text-sm text-gray-500">Archived</div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="illustration">Illustration</SelectItem>
            <SelectItem value="storyboard">Storyboard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastActivity">Last Activity</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="deadline">Deadline</SelectItem>
            <SelectItem value="progress">Progress</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Creator</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProjects.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-gray-400" />
                    {project.name}
                  </div>
                </TableCell>
                <TableCell>{project.creator}</TableCell>
                <TableCell>{getTypeBadge(project.type)}</TableCell>
                <TableCell>{getStatusBadge(project.status)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={project.progress} className="w-20" />
                    <span className="text-sm text-gray-500">{project.progress}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-gray-400" />
                    {project.participants}
                  </div>
                </TableCell>
                <TableCell>{getDeadlineStatus(project.deadline)}</TableCell>
                <TableCell className="text-sm text-gray-500">
                  {new Date(project.lastActivity).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Users className="h-4 w-4 mr-2" />
                        Manage Participants
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {project.status === 'active' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(project.id, 'completed')}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark as Completed
                        </DropdownMenuItem>
                      )}
                      {project.status !== 'archived' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(project.id, 'archived')}
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive Project
                        </DropdownMenuItem>
                      )}
                      {project.status === 'archived' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(project.id, 'active')}
                        >
                          <Folder className="h-4 w-4 mr-2" />
                          Restore Project
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => handleDeleteProject(project.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
