'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  Folder, 
  HardDrive, 
  Activity,
  TrendingUp,
  TrendingDown,
  Image,
  MessageSquare,
  Clock,
  CheckCircle
} from 'lucide-react';

interface SystemStat {
  label: string;
  value: number | string;
  change?: number;
  icon: React.ReactNode;
  unit?: string;
}

interface ActivityLog {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
}

// Mock data
const mockStats = {
  totalUsers: 125,
  activeUsers: 89,
  totalProjects: 45,
  activeProjects: 23,
  totalStorage: 50 * 1024 * 1024 * 1024, // 50GB in bytes
  usedStorage: 23.5 * 1024 * 1024 * 1024, // 23.5GB in bytes
  totalImages: 3456,
  totalComments: 892,
  userGrowth: 12.5,
  projectGrowth: 8.3,
  storageGrowth: -2.1,
  dailyActiveUsers: [65, 72, 68, 75, 82, 79, 89],
  projectsByType: {
    illustration: 28,
    storyboard: 17
  },
  projectsByStatus: {
    active: 23,
    completed: 15,
    archived: 7
  }
};

const mockActivityLogs: ActivityLog[] = [
  {
    id: '1',
    user: 'john_doe',
    action: 'created',
    target: 'Summer Campaign Illustrations',
    timestamp: '2024-01-15T14:30:00Z'
  },
  {
    id: '2',
    user: 'jane_smith',
    action: 'uploaded',
    target: '5 images to Product Launch',
    timestamp: '2024-01-15T13:45:00Z'
  },
  {
    id: '3',
    user: 'alice_brown',
    action: 'commented on',
    target: 'Holiday Season Assets',
    timestamp: '2024-01-15T12:20:00Z'
  },
  {
    id: '4',
    user: 'bob_wilson',
    action: 'completed',
    target: 'Training Video Storyboard',
    timestamp: '2024-01-15T11:15:00Z'
  },
  {
    id: '5',
    user: 'admin',
    action: 'archived',
    target: 'Old Marketing Materials',
    timestamp: '2024-01-15T10:00:00Z'
  }
];

export default function SystemStats() {
  const [stats, setStats] = useState<typeof mockStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    // Load mock data
    setStats(mockStats);
    setActivityLogs(mockActivityLogs);
  }, []);

  if (!stats) {
    return <div>Loading...</div>;
  }

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(1) + ' GB';
  };

  const storagePercentage = (stats.usedStorage / stats.totalStorage) * 100;

  const statCards: SystemStat[] = [
    {
      label: 'Total Users',
      value: stats.totalUsers,
      change: stats.userGrowth,
      icon: <Users className="h-5 w-5" />
    },
    {
      label: 'Active Users',
      value: stats.activeUsers,
      icon: <Activity className="h-5 w-5" />
    },
    {
      label: 'Total Projects',
      value: stats.totalProjects,
      change: stats.projectGrowth,
      icon: <Folder className="h-5 w-5" />
    },
    {
      label: 'Active Projects',
      value: stats.activeProjects,
      icon: <Clock className="h-5 w-5" />
    },
    {
      label: 'Total Images',
      value: stats.totalImages.toLocaleString(),
      // eslint-disable-next-line jsx-a11y/alt-text
      icon: <Image className="h-5 w-5" aria-hidden="true" />
    },
    {
      label: 'Total Comments',
      value: stats.totalComments.toLocaleString(),
      icon: <MessageSquare className="h-5 w-5" />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">System Statistics</h2>
        <p className="text-gray-700 mt-1">Overview of system usage and performance</p>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.label}
              </CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.change && (
                <div className="flex items-center text-sm mt-1">
                  {stat.change > 0 ? (
                    <>
                      <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                      <span className="text-green-600">+{stat.change}%</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                      <span className="text-red-600">{stat.change}%</span>
                    </>
                  )}
                  <span className="text-gray-700 ml-1">from last month</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Storage Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Usage
          </CardTitle>
          <CardDescription>
            {formatBytes(stats.usedStorage)} of {formatBytes(stats.totalStorage)} used
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={storagePercentage} className="w-full h-3" />
          <div className="flex justify-between text-sm text-gray-700 mt-2">
            <span>{storagePercentage.toFixed(1)}% used</span>
            <span>{formatBytes(stats.totalStorage - stats.usedStorage)} available</span>
          </div>
        </CardContent>
      </Card>

      {/* Project Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Projects by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Illustration</span>
                  <span className="font-medium">{stats.projectsByType.illustration}</span>
                </div>
                <Progress 
                  value={(stats.projectsByType.illustration / stats.totalProjects) * 100} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Storyboard</span>
                  <span className="font-medium">{stats.projectsByType.storyboard}</span>
                </div>
                <Progress 
                  value={(stats.projectsByType.storyboard / stats.totalProjects) * 100} 
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Active
                  </span>
                  <span className="font-medium">{stats.projectsByStatus.active}</span>
                </div>
                <Progress 
                  value={(stats.projectsByStatus.active / stats.totalProjects) * 100} 
                  className="h-2 bg-green-100"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Completed
                  </span>
                  <span className="font-medium">{stats.projectsByStatus.completed}</span>
                </div>
                <Progress 
                  value={(stats.projectsByStatus.completed / stats.totalProjects) * 100} 
                  className="h-2 bg-blue-100"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Archived</span>
                  <span className="font-medium">{stats.projectsByStatus.archived}</span>
                </div>
                <Progress 
                  value={(stats.projectsByStatus.archived / stats.totalProjects) * 100} 
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Active Users Chart (Simple) */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Active Users (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between h-32 gap-2">
            {stats.dailyActiveUsers.map((value, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-blue-500 rounded-t"
                  style={{ 
                    height: `${(value / Math.max(...stats.dailyActiveUsers)) * 100}%`,
                    minHeight: '4px'
                  }}
                />
                <span className="text-xs text-gray-700 mt-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Admin Activity</CardTitle>
          <CardDescription>Latest system actions and changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activityLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                <div className="flex-1">
                  <div className="text-sm">
                    <span className="font-medium">{log.user}</span>
                    <span className="text-gray-700"> {log.action} </span>
                    <span className="font-medium">{log.target}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
