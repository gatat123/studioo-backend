'use client';

import React, { useEffect, useState } from 'react';
import { CommentItem } from './CommentItem';
import { CommentComposer } from './CommentComposer';
import { CommentSectionProps, SortOption } from '@/types/comment';
import useCommentStore from '@/store/useCommentStore';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CommentSection: React.FC<CommentSectionProps> = ({
  projectId,
  sceneId,
  className
}) => {
  const {
    comments,
    sortBy,
    isLoading,
    error,
    hasMore,
    setSortBy,
    loadMoreComments,
    setError
  } = useCommentStore();

  const [activeTab, setActiveTab] = useState<'all' | 'scene' | 'project'>('all');

  // Filter comments based on active tab
  const filteredComments = comments.filter(comment => {
    if (activeTab === 'all') return true;
    if (activeTab === 'scene') return comment.sceneId === sceneId;
    if (activeTab === 'project') return comment.projectId === projectId && !comment.sceneId;
    return false;
  });

  const handleSortChange = (value: string) => {
    setSortBy(value as SortOption);
  };

  const handleLoadMore = async () => {
    try {
      await loadMoreComments();
    } catch (err) {
      setError('댓글을 불러오는 중 오류가 발생했습니다.');
    }
  };

  // Calculate total comments including replies
  const getTotalCommentCount = () => {
    let count = filteredComments.length;
    filteredComments.forEach(comment => {
      count += comment.replies?.length || 0;
    });
    return count;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h3 className="text-lg font-semibold">
            댓글 ({getTotalCommentCount()})
          </h3>
        </div>
        
        <Select value={sortBy} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">최신순</SelectItem>
            <SelectItem value="oldest">오래된순</SelectItem>
            <SelectItem value="mostReplies">답글 많은순</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs for filtering */}
      {(projectId || sceneId) && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="scene">씬 댓글</TabsTrigger>
            <TabsTrigger value="project">프로젝트 댓글</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Comment Composer */}
      <CommentComposer
        projectId={projectId}
        sceneId={sceneId}
      />

      {/* Comments List */}
      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {filteredComments.length === 0 && !isLoading ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              아직 댓글이 없습니다. 첫 번째 댓글을 작성해보세요!
            </p>
          </div>
        ) : (
          <>
            {filteredComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
              />
            ))}
          </>
        )}

        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {hasMore && !isLoading && filteredComments.length > 0 && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoading}
            >
              더 보기
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
