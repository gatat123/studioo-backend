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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  MoreHorizontal, 
  UserCheck, 
  UserX, 
  Shield,
  ShieldOff,
  Mail,
  Filter
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  nickname: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  lastLogin: string;
}

// Mock data
const mockUsers: User[] = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@example.com',
    nickname: 'Administrator',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: '2024-01-15T12:00:00Z'
  },
  {
    id: '2',
    username: 'john_doe',
    email: 'john@example.com',
    nickname: 'John Doe',
    role: 'user',
    status: 'active',
    createdAt: '2024-01-05T00:00:00Z',
    lastLogin: '2024-01-14T10:30:00Z'
  },
  {
    id: '3',
    username: 'jane_smith',
    email: 'jane@example.com',
    nickname: 'Jane Smith',
    role: 'user',
    status: 'inactive',
    createdAt: '2024-01-07T00:00:00Z',
    lastLogin: '2024-01-10T15:45:00Z'
  },
  {
    id: '4',
    username: 'bob_wilson',
    email: 'bob@example.com',
    nickname: 'Bob Wilson',
    role: 'user',
    status: 'suspended',
    createdAt: '2024-01-10T00:00:00Z',
    lastLogin: '2024-01-12T08:20:00Z'
  },
  {
    id: '5',
    username: 'alice_brown',
    email: 'alice@example.com',
    nickname: 'Alice Brown',
    role: 'user',
    status: 'active',
    createdAt: '2024-01-12T00:00:00Z',
    lastLogin: '2024-01-15T14:00:00Z'
  }
];

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    // Load mock data
    setUsers(mockUsers);
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.nickname.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
  };

  const handleRoleChange = (userId: string, newRole: 'admin' | 'user') => {
    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, role: newRole } : user
    ));
  };

  const handleStatusChange = (userId: string, newStatus: 'active' | 'inactive' | 'suspended') => {
    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, status: newStatus } : user
    ));
  };

  const handleBulkAction = (action: string) => {
    console.log(`Bulk action: ${action} for users:`, selectedUsers);
    // Implement bulk actions here
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
      case 'suspended':
        return <Badge className="bg-red-100 text-red-800">Suspended</Badge>;
      default:
        return null;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-100 text-purple-800">Admin</Badge>;
      case 'user':
        return <Badge className="bg-blue-100 text-blue-800">User</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {filteredUsers.length} users found
          </span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <span className="text-sm font-medium">
            {selectedUsers.length} selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('activate')}
            >
              <UserCheck className="h-4 w-4 mr-1" />
              Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('suspend')}
            >
              <UserX className="h-4 w-4 mr-1" />
              Suspend
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('delete')}
              className="text-red-600 hover:text-red-700"
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    filteredUsers.length > 0 && 
                    selectedUsers.length === filteredUsers.length
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Nickname</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={() => handleSelectUser(user.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.nickname}</TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell>{getStatusBadge(user.status)}</TableCell>
                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(user.lastLogin).toLocaleDateString()}</TableCell>
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
                        <Mail className="h-4 w-4 mr-2" />
                        Send Email
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleRoleChange(
                          user.id, 
                          user.role === 'admin' ? 'user' : 'admin'
                        )}
                      >
                        {user.role === 'admin' ? (
                          <>
                            <ShieldOff className="h-4 w-4 mr-2" />
                            Remove Admin
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4 mr-2" />
                            Make Admin
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(
                          user.id,
                          user.status === 'active' ? 'suspended' : 'active'
                        )}
                      >
                        {user.status === 'active' ? (
                          <>
                            <UserX className="h-4 w-4 mr-2" />
                            Suspend User
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Activate User
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        Delete User
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
