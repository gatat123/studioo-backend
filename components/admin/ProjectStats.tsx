'use client';

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';

interface ProjectStat {
  tag: string;
  count: number;
  percentage: number;
}

interface StatusStat {
  status: string;
  count: number;
  color: string;
}

export default function ProjectStats() {
  const [projectStats, setProjectStats] = useState<ProjectStat[]>([]);
  const [statusStats, setStatusStats] = useState<StatusStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProjectStats();
  }, []);

  const fetchProjectStats = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');

      if (!token) {
        console.warn('No authentication token found for project stats');
        // Set mock data for demonstration
        setProjectStats([
          { tag: '일러스트레이션', count: 12, percentage: 40 },
          { tag: '스토리보드', count: 15, percentage: 50 },
          { tag: '기타', count: 3, percentage: 10 },
        ]);

        setStatusStats([
          { status: '활성', count: 18, color: 'bg-green-500' },
          { status: '완료', count: 8, color: 'bg-blue-500' },
          { status: '보관', count: 4, color: 'bg-gray-500' },
        ]);
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/admin/projects/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();

        // Process tag statistics
        const tagStats: ProjectStat[] = [
          { tag: '일러스트레이션', count: data.illustrationCount || 0, percentage: 0 },
          { tag: '스토리보드', count: data.storyboardCount || 0, percentage: 0 },
          { tag: '기타', count: data.otherCount || 0, percentage: 0 },
        ];

        const totalProjects = tagStats.reduce((sum, stat) => sum + stat.count, 0);
        tagStats.forEach(stat => {
          stat.percentage = totalProjects > 0 ? (stat.count / totalProjects) * 100 : 0;
        });

        setProjectStats(tagStats);

        // Process status statistics
        const statuses: StatusStat[] = [
          { status: '활성', count: data.activeCount || 0, color: 'bg-green-500' },
          { status: '완료', count: data.completedCount || 0, color: 'bg-blue-500' },
          { status: '보관', count: data.archivedCount || 0, color: 'bg-gray-500' },
        ];

        setStatusStats(statuses);
      }
    } catch {

      // Set mock data for demonstration
      setProjectStats([
        { tag: '일러스트레이션', count: 12, percentage: 40 },
        { tag: '스토리보드', count: 15, percentage: 50 },
        { tag: '기타', count: 3, percentage: 10 },
      ]);

      setStatusStats([
        { status: '활성', count: 18, color: 'bg-green-500' },
        { status: '완료', count: 8, color: 'bg-blue-500' },
        { status: '보관', count: 4, color: 'bg-gray-500' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalProjects = projectStats.reduce((sum, stat) => sum + stat.count, 0);

  return (
    <div className="space-y-6">
      {/* Project by Tag */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          태그별 프로젝트 분포
        </h3>
        <div className="space-y-3">
          {projectStats.map((stat) => (
            <div key={stat.tag}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-600">{stat.tag}</span>
                <span className="font-medium">{stat.count}개</span>
              </div>
              <Progress value={stat.percentage} className="h-2" />
            </div>
          ))}
        </div>
        <div className="mt-3 text-sm text-gray-700">
          총 {totalProjects}개 프로젝트
        </div>
      </div>

      {/* Project by Status */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          상태별 프로젝트
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {statusStats.map((stat) => (
            <div key={stat.status} className="text-center">
              <div className={`h-20 ${stat.color} rounded-lg mb-2 flex items-center justify-center`}>
                <span className="text-2xl font-bold text-white">{stat.count}</span>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-600">{stat.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          최근 활동
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-600">오늘 생성된 프로젝트</span>
            <span className="font-medium">2개</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-600">이번 주 완료된 프로젝트</span>
            <span className="font-medium">5개</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-600">평균 프로젝트 기간</span>
            <span className="font-medium">14일</span>
          </div>
        </div>
      </div>
    </div>
  );
}