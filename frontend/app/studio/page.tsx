'use client';

import { useState } from 'react';
import { Plus, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectGrid } from '@/components/projects/ProjectGrid';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { useAuthStore } from '@/store/useAuthStore';
import { useProjectStore } from '@/store/useProjectStore';

export default function StudioPage() {
  const { user } = useAuthStore();
  const { projects } = useProjectStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Count projects with updates
  const projectsWithUpdates = projects.filter(p => p.hasUpdates).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">스튜디오</h1>
                <p className="text-gray-600 mt-1">
                  {user?.nickname || user?.username}님의 작업 공간
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Notifications */}
                {projectsWithUpdates > 0 && (
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {projectsWithUpdates}
                    </span>
                  </Button>
                )}
                
                {/* Create Project Button */}
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  새 프로젝트
                </Button>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex gap-6 mt-4">
              <div>
                <span className="text-2xl font-bold text-gray-900">
                  {projects.filter(p => p.status === 'active').length}
                </span>
                <span className="text-gray-600 ml-2">진행중</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-gray-900">
                  {projects.filter(p => p.status === 'completed').length}
                </span>
                <span className="text-gray-600 ml-2">완료</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-gray-900">
                  {projects.length}
                </span>
                <span className="text-gray-600 ml-2">전체</span>
              </div>
            </div>
          </div>

          {/* Project Grid Component */}
          <ProjectGrid />
        </div>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal} 
      />
    </div>
  );
}
