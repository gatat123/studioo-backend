import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Comment, SortOption } from '@/types/comment';

interface CommentState {
  comments: Comment[];
  sortBy: SortOption;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  hasMore: boolean;
  
  // Actions
  addComment: (comment: Comment) => void;
  updateComment: (id: string, content: string) => void;
  deleteComment: (id: string) => void;
  addReply: (parentId: string, reply: Comment) => void;
  setComments: (comments: Comment[]) => void;
  setSortBy: (sortBy: SortOption) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadMoreComments: () => Promise<void>;
  resetComments: () => void;
}

// Mock data generator
const generateMockComments = (): Comment[] => {
  const users = [
    { id: '1', username: 'john_doe', nickname: 'John', profileImage: '/avatars/user1.jpg' },
    { id: '2', username: 'jane_smith', nickname: 'Jane', profileImage: '/avatars/user2.jpg' },
    { id: '3', username: 'bob_wilson', nickname: 'Bob', profileImage: '/avatars/user3.jpg' },
  ];

  const comments: Comment[] = [
    {
      id: '1',
      content: '이 씬의 구도가 정말 좋네요! 캐릭터의 표정이 잘 살아있습니다.',
      user: users[0],
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      isEdited: false,
      replies: [
        {
          id: '2',
          content: '감사합니다! 표정 표현에 많은 신경을 썼어요.',
          user: users[1],
          createdAt: new Date(Date.now() - 1800000).toISOString(),
          isEdited: false,
          parentId: '1',
        }
      ]
    },
    {
      id: '3',
      content: '배경 색상을 조금 더 밝게 하면 어떨까요? 전체적인 분위기가 너무 어두운 것 같아요.',
      user: users[2],
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      isEdited: true,
      updatedAt: new Date(Date.now() - 6000000).toISOString(),
      replies: []
    },
    {
      id: '4',
      content: '라인아트 버전도 확인해주세요. 몇 가지 수정사항이 있습니다.',
      user: users[1],
      createdAt: new Date(Date.now() - 10800000).toISOString(),
      isEdited: false,
      attachments: [
        {
          id: 'att1',
          url: '/attachments/reference.jpg',
          type: 'image',
          name: 'reference.jpg',
          size: 245000
        }
      ],
      replies: []
    }
  ];

  return comments;
};

const useCommentStore = create<CommentState>()(
  devtools(
    persist(
      (set, get) => ({
        comments: [],
        sortBy: 'newest',
        isLoading: false,
        error: null,
        currentPage: 1,
        hasMore: true,

        addComment: (comment) => {
          set((state) => ({
            comments: [comment, ...state.comments]
          }));
        },

        updateComment: (id, content) => {
          set((state) => ({
            comments: state.comments.map(comment => {
              if (comment.id === id) {
                return {
                  ...comment,
                  content,
                  isEdited: true,
                  updatedAt: new Date().toISOString()
                };
              }
              // Check replies
              if (comment.replies) {
                return {
                  ...comment,
                  replies: comment.replies.map(reply =>
                    reply.id === id
                      ? { ...reply, content, isEdited: true, updatedAt: new Date().toISOString() }
                      : reply
                  )
                };
              }
              return comment;
            })
          }));
        },

        deleteComment: (id) => {
          set((state) => ({
            comments: state.comments.filter(comment => {
              if (comment.id === id) return false;
              // Filter out deleted replies
              if (comment.replies) {
                comment.replies = comment.replies.filter(reply => reply.id !== id);
              }
              return true;
            })
          }));
        },

        addReply: (parentId, reply) => {
          set((state) => ({
            comments: state.comments.map(comment => {
              if (comment.id === parentId) {
                return {
                  ...comment,
                  replies: [...(comment.replies || []), reply]
                };
              }
              return comment;
            })
          }));
        },

        setComments: (comments) => set({ comments }),
        
        setSortBy: (sortBy) => {
          set({ sortBy });
          // Re-sort comments
          const { comments } = get();
          let sorted = [...comments];
          
          switch (sortBy) {
            case 'newest':
              sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              break;
            case 'oldest':
              sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
              break;
            case 'mostReplies':
              sorted.sort((a, b) => (b.replies?.length || 0) - (a.replies?.length || 0));
              break;
          }
          
          set({ comments: sorted });
        },

        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),

        loadMoreComments: async () => {
          const { currentPage } = get();
          set({ isLoading: true });
          
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // For demo, just set hasMore to false after page 2
          if (currentPage >= 2) {
            set({ hasMore: false, isLoading: false });
          } else {
            // Generate more mock comments
            const newComments = generateMockComments().map(c => ({
              ...c,
              id: `page${currentPage + 1}_${c.id}`
            }));
            
            set((state) => ({
              comments: [...state.comments, ...newComments],
              currentPage: currentPage + 1,
              isLoading: false
            }));
          }
        },

        resetComments: () => {
          set({
            comments: [],
            sortBy: 'newest',
            isLoading: false,
            error: null,
            currentPage: 1,
            hasMore: true
          });
        }
      }),
      {
        name: 'comment-storage'
      }
    )
  )
);

export default useCommentStore;

// Initialize with mock data
if (typeof window !== 'undefined') {
  const store = useCommentStore.getState();
  if (store.comments.length === 0) {
    store.setComments(generateMockComments());
  }
}
