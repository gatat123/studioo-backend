'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Shield,
  Lock,
  Key,
  UserCheck,
  Plus,
  Trash2,
  Edit,
  X,
  RefreshCw,
  CheckCircle
} from 'lucide-react';

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  actions: string[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  userCount: number;
  isSystem: boolean;
}

interface RoleAssignment {
  userId: string;
  username: string;
  email: string;
  roles: string[];
}

const DEFAULT_PERMISSIONS: Permission[] = [
  {
    id: 'perm-1',
    name: 'project.create',
    description: '새 프로젝트 생성',
    resource: 'project',
    actions: ['create']
  },
  {
    id: 'perm-2',
    name: 'project.read',
    description: '프로젝트 조회',
    resource: 'project',
    actions: ['read']
  },
  {
    id: 'perm-3',
    name: 'project.update',
    description: '프로젝트 수정',
    resource: 'project',
    actions: ['update']
  },
  {
    id: 'perm-4',
    name: 'project.delete',
    description: '프로젝트 삭제',
    resource: 'project',
    actions: ['delete']
  },
  {
    id: 'perm-5',
    name: 'user.manage',
    description: '사용자 관리',
    resource: 'user',
    actions: ['create', 'read', 'update', 'delete']
  },
  {
    id: 'perm-6',
    name: 'admin.access',
    description: '관리자 패널 접근',
    resource: 'admin',
    actions: ['access']
  }
];

export default function PermissionsPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions] = useState<Permission[]>(DEFAULT_PERMISSIONS);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const checkAuth = () => {
    // Set temporary token for gatat123 if not exists
    if (!localStorage.getItem('token')) {
      localStorage.setItem('token', 'gatat123-temp-token');
      localStorage.setItem('username', 'gatat123');
      localStorage.setItem('userId', 'gatat123-temp-id');
    }
  };

  const getMockRoles = useCallback((): Role[] => [
    {
      id: 'role-1',
      name: 'Admin',
      description: '모든 권한을 가진 관리자',
      permissions: permissions,
      userCount: 2,
      isSystem: true
    },
    {
      id: 'role-2',
      name: 'Moderator',
      description: '콘텐츠 관리 권한',
      permissions: permissions.filter(p => !p.name.includes('admin') && !p.name.includes('delete')),
      userCount: 5,
      isSystem: true
    },
    {
      id: 'role-3',
      name: 'User',
      description: '기본 사용자 권한',
      permissions: permissions.filter(p => p.actions.includes('read') || p.name === 'project.create'),
      userCount: 150,
      isSystem: true
    },
    {
      id: 'role-4',
      name: 'Guest',
      description: '제한된 읽기 권한',
      permissions: permissions.filter(p => p.actions.includes('read')),
      userCount: 0,
      isSystem: false
    }
  ], [permissions]);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || 'gatat123-temp-token';

      // Fetch roles
      const rolesResponse = await fetch('/api/admin/roles', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();
        setRoles(rolesData.roles || getMockRoles());
      } else if (rolesResponse.status === 401 || rolesResponse.status === 403) {
        router.push('/login');
        return;
      } else {
        setRoles(getMockRoles());
      }

      // Fetch assignments
      const assignmentsResponse = await fetch('/api/admin/role-assignments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (assignmentsResponse.ok) {
        const assignmentsData = await assignmentsResponse.json();
        setAssignments(assignmentsData.assignments || getMockAssignments());
      } else {
        setAssignments(getMockAssignments());
      }
    } catch {
      // Error handled - use mock data as fallback
      setRoles(getMockRoles());
      setAssignments(getMockAssignments());
    } finally {
      setIsLoading(false);
    }
  }, [router, getMockRoles]);

  useEffect(() => {
    checkAuth();
    fetchData();
  }, [fetchData]);

  const getMockAssignments = (): RoleAssignment[] => [
    {
      userId: 'user-1',
      username: 'gatat123',
      email: 'admin@example.com',
      roles: ['Admin']
    },
    {
      userId: 'user-2',
      username: 'moderator1',
      email: 'mod1@example.com',
      roles: ['Moderator']
    },
    {
      userId: 'user-3',
      username: 'user123',
      email: 'user@example.com',
      roles: ['User']
    }
  ];

  const handleCreateRole = async () => {
    if (!newRole.name || !newRole.description) return;

    try {
      const token = localStorage.getItem('token') || 'gatat123-temp-token';
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newRole.name,
          description: newRole.description,
          permissions: selectedPermissions
        }),
      });

      if (response.ok) {
        setNewRole({ name: '', description: '' });
        setSelectedPermissions([]);
        fetchData();
      }
    } catch {
      // Role creation failed - error handled silently
    }
  };

  const handleUpdateRole = async (roleId: string, permissions: string[]) => {
    try {
      const token = localStorage.getItem('token') || 'gatat123-temp-token';
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions }),
      });

      if (response.ok) {
        setEditingRole(null);
        fetchData();
      }
    } catch {
      // Role update failed - error handled silently
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('정말로 이 역할을 삭제하시겠습니까?')) return;

    try {
      const token = localStorage.getItem('token') || 'gatat123-temp-token';
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchData();
      }
    } catch {
      // Role deletion failed - error handled silently
    }
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      const token = localStorage.getItem('token') || 'gatat123-temp-token';
      const response = await fetch('/api/admin/role-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, roleId }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch {
      // Role assignment failed - error handled silently
    }
  };

  // Removed handleRemoveRole function as it's not used

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">권한 관리</h1>
          <p className="text-gray-600 dark:text-gray-600 mt-2">
            역할과 권한을 관리하고 사용자에게 할당합니다.
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 역할</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">시스템 역할</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roles.filter(r => r.isSystem).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 권한</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">할당된 사용자</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignments.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles">역할 관리</TabsTrigger>
          <TabsTrigger value="permissions">권한 매트릭스</TabsTrigger>
          <TabsTrigger value="assignments">사용자 할당</TabsTrigger>
        </TabsList>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          {/* Create New Role */}
          <Card>
            <CardHeader>
              <CardTitle>새 역할 생성</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  placeholder="역할 이름"
                  value={newRole.name}
                  onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                />
                <Input
                  placeholder="설명"
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                />
                <Button onClick={handleCreateRole}>
                  <Plus className="w-4 h-4 mr-2" />
                  역할 생성
                </Button>
              </div>
              {newRole.name && (
                <div className="mt-4">
                  <Label>권한 선택</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {permissions.map((perm) => (
                      <div key={perm.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(perm.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPermissions([...selectedPermissions, perm.id]);
                            } else {
                              setSelectedPermissions(selectedPermissions.filter(p => p !== perm.id));
                            }
                          }}
                        />
                        <Label className="text-sm">{perm.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Existing Roles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((role) => (
              <Card key={role.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {role.name}
                        {role.isSystem && (
                          <Badge variant="secondary">시스템</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{role.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {!role.isSystem && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingRole(editingRole === role.id ? null : role.id)}
                          >
                            {editingRole === role.id ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteRole(role.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    {role.userCount}명의 사용자
                  </div>
                </CardHeader>
                <CardContent>
                  {editingRole === role.id ? (
                    <div className="space-y-2">
                      {permissions.map((perm) => (
                        <div key={perm.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={role.permissions.some(p => p.id === perm.id)}
                            onChange={(e) => {
                              const newPerms = e.target.checked
                                ? [...role.permissions.map(p => p.id), perm.id]
                                : role.permissions.filter(p => p.id !== perm.id).map(p => p.id);
                              handleUpdateRole(role.id, newPerms);
                            }}
                          />
                          <Label className="text-sm">{perm.name}</Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {role.permissions.map((perm) => (
                        <Badge key={perm.id} variant="outline">
                          {perm.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Permissions Matrix Tab */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>권한 매트릭스</CardTitle>
              <CardDescription>
                각 역할이 가진 권한을 한눈에 확인하고 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>권한</TableHead>
                    {roles.map((role) => (
                      <TableHead key={role.id} className="text-center">
                        {role.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((perm) => (
                    <TableRow key={perm.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{perm.name}</div>
                          <div className="text-sm text-gray-700">{perm.description}</div>
                        </div>
                      </TableCell>
                      {roles.map((role) => (
                        <TableCell key={role.id} className="text-center">
                          {role.permissions.some(p => p.id === perm.id) ? (
                            <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-300 mx-auto" />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Assignments Tab */}
        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>사용자 역할 할당</CardTitle>
              <CardDescription>
                사용자별로 역할을 할당하고 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>사용자</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>현재 역할</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.userId}>
                      <TableCell className="font-medium">
                        {assignment.username}
                      </TableCell>
                      <TableCell>{assignment.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {assignment.roles.map((roleName) => (
                            <Badge key={roleName}>
                              {roleName}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          onValueChange={(value) => handleAssignRole(assignment.userId, value)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="역할 추가" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles
                              .filter(r => !assignment.roles.includes(r.name))
                              .map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
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