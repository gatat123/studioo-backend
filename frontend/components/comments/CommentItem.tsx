'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Comment } from '@/types/comment';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Edit2,
  Trash2,
  Reply,
  Paperclip,
  Image as ImageIcon,
  Check,
  X
} from 'lucide-react';
import useCommentStore from '@/store/useCommentStore';
import { cn } from '@/lib/utils';

interface CommentItemProps {
  comment: Comment;
  isReply?: boolean;
  onReply?: (commentId: string) => void;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  isReply = false,
  onReply
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  
  const { updateComment, deleteComment, addReply } = useCommentStore();

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(comment.content);
  };

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      updateComment(comment.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(comment.content);
  };

  const handleDelete = () => {
    if (confirm('정말로 이 댓글을 삭제하시겠습니까?')) {
      deleteComment(comment.id);
    }
  };

  const handleReply = () => {
    if (replyContent.trim()) {
      const newReply: Comment = {
        id: `reply_${Date.now()}`,
        content: replyContent.trim(),
        user: {
          id: 'current_user',
          username: 'current_user',
          nickname: '현재 사용자'
        },
        createdAt: new Date().toISOString(),
        isEdited: false,
        parentId: comment.id
      };
      
      addReply(comment.id, newReply);
      setReplyContent('');
      setShowReplyForm(false);
    }
  };

  const getInitials = (nickname: string) => {
    return nickname
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn(
      "group",
      isReply && "ml-12"
    )}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.user.profileImage} />
          <AvatarFallback className="text-xs">
            {getInitials(comment.user.nickname)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                {comment.user.nickname}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.createdAt), {
                  addSuffix: true,
                  locale: ko
                })}
              </span>
              {comment.isEdited && (
                <span className="text-xs text-muted-foreground">(수정됨)</span>
              )}
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  수정
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={!editContent.trim()}
                >
                  <Check className="h-4 w-4 mr-1" />
                  저장
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelEdit}
                >
                  <X className="h-4 w-4 mr-1" />
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm whitespace-pre-wrap break-words">
                {comment.content}
              </p>
              
              {comment.attachments && comment.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {comment.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-xs"
                    >
                      {attachment.type === 'image' ? (
                        <ImageIcon className="h-3 w-3" />
                      ) : (
                        <Paperclip className="h-3 w-3" />
                      )}
                      <span>{attachment.name}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {!isReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-auto p-1 text-xs"
                  onClick={() => setShowReplyForm(!showReplyForm)}
                >
                  <Reply className="h-3 w-3 mr-1" />
                  답글
                </Button>
              )}
            </>
          )}

          {showReplyForm && (
            <div className="mt-3 space-y-2">
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="답글을 입력하세요..."
                className="min-h-[60px] resize-none text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={!replyContent.trim()}
                >
                  답글 작성
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyContent('');
                  }}
                >
                  취소
                </Button>
              </div>
            </div>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  isReply={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
