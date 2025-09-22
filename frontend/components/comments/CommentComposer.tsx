'use client';

import React, { useState, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Bold,
  Italic,
  Link,
  Image as ImageIcon,
  Paperclip,
  Send,
  Smile
} from 'lucide-react';
import { Comment } from '@/types/comment';
import useCommentStore from '@/store/useCommentStore';
import { cn } from '@/lib/utils';

interface CommentComposerProps {
  projectId?: string;
  sceneId?: string;
  className?: string;
}

export const CommentComposer: React.FC<CommentComposerProps> = ({
  projectId,
  sceneId,
  className
}) => {
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { addComment } = useCommentStore();

  const handleSubmit = () => {
    if (content.trim()) {
      const newComment: Comment = {
        id: `comment_${Date.now()}`,
        content: content.trim(),
        user: {
          id: 'current_user',
          username: 'current_user',
          nickname: '현재 사용자'
        },
        createdAt: new Date().toISOString(),
        isEdited: false,
        projectId,
        sceneId
      };
      
      addComment(newComment);
      setContent('');
      setIsExpanded(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const insertFormatting = (format: 'bold' | 'italic') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText || '굵은 텍스트'}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText || '기울임 텍스트'}*`;
        break;
    }

    const newContent = 
      content.substring(0, start) + 
      formattedText + 
      content.substring(end);
    
    setContent(newContent);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + (format === 'bold' ? 2 : 1),
        start + formattedText.length - (format === 'bold' ? 2 : 1)
      );
    }, 0);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src="/avatar/current-user.jpg" />
          <AvatarFallback>나</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-2">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            onKeyDown={handleKeyDown}
            placeholder="댓글을 입력하세요... (Ctrl+Enter로 전송)"
            className={cn(
              "resize-none transition-all",
              isExpanded ? "min-h-[100px]" : "min-h-[40px]"
            )}
          />
          
          {isExpanded && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => insertFormatting('bold')}
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => insertFormatting('italic')}
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setContent('');
                      setIsExpanded(false);
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!content.trim()}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    댓글 작성
                  </Button>
                </div>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  // Handle file upload
                  console.log('File selected:', e.target.files);
                }}
              />
            </>
          )}
        </div>
      </div>
      
      {!isExpanded && content && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim()}
          >
            <Send className="h-4 w-4 mr-1" />
            댓글 작성
          </Button>
        </div>
      )}
    </div>
  );
};
