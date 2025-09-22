export interface User {
  id: string;
  username: string;
  nickname: string;
  profileImage?: string;
}

export interface Comment {
  id: string;
  content: string;
  user: User;
  createdAt: string;
  updatedAt?: string;
  isEdited: boolean;
  parentId?: string;
  replies?: Comment[];
  attachments?: CommentAttachment[];
  projectId?: string;
  sceneId?: string;
}

export interface CommentAttachment {
  id: string;
  url: string;
  type: 'image' | 'file';
  name: string;
  size: number;
}

export type SortOption = 'newest' | 'oldest' | 'mostReplies';

export interface CommentSectionProps {
  projectId?: string;
  sceneId?: string;
  className?: string;
}
