import api, { APIError } from './client'

export interface WorkTask {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  startDate?: string
  completedAt?: string
  assigneeId?: string
  createdById: string
  position: number
  tags?: string[]
  inviteCode?: string
  createdAt: string
  updatedAt: string

  // Relations
  createdBy?: {
    id: string
    username: string
    nickname: string
    profileImageUrl?: string
  }
  participants?: WorkTaskParticipant[]
  comments?: WorkTaskComment[]
  subTasks?: SubTask[]
}

export interface WorkTaskParticipant {
  id: string
  workTaskId: string
  userId: string
  role: 'creator' | 'assignee' | 'member' | 'viewer'
  joinedAt: string
  lastViewedAt?: string

  user: {
    id: string
    username: string
    nickname: string
    profileImageUrl?: string
  }
}

export interface WorkTaskComment {
  id: string
  workTaskId: string
  userId: string
  content: string
  createdAt: string
  updatedAt: string
  isEdited: boolean
  isDeleted: boolean

  user: {
    id: string
    username: string
    nickname: string
    profileImageUrl?: string
  }
}

export interface SubTask {
  id: string
  workTaskId: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  startDate?: string
  completedAt?: string
  assigneeId?: string
  createdById: string
  position: number
  tags?: string[]
  createdAt: string
  updatedAt: string

  // 추가된 필드들
  lastModifiedAt?: string
  timeSinceLastModified?: number

  // Relations
  createdBy?: {
    id: string
    nickname: string
    profileImageUrl?: string
  }
  assignee?: {
    id: string
    nickname: string
    profileImageUrl?: string
  }
  participants?: SubTaskParticipant[]
  comments?: SubTaskComment[]
  workTask?: {
    id: string
    title: string
    participants?: WorkTaskParticipant[]
  }
}

export interface SubTaskParticipant {
  id: string
  subtaskId: string
  userId: string
  role?: string
  joinedAt?: string

  user: {
    id: string
    nickname: string
    profileImageUrl?: string
  }
}

export interface SubTaskComment {
  id: string
  subTaskId: string
  userId: string
  content: string
  createdAt: string
  updatedAt: string
  isEdited: boolean
  isDeleted: boolean

  user: {
    id: string
    nickname: string
    profileImageUrl?: string
  }
}

export interface SubTaskAttachment {
  id: string
  subTaskId: string
  fileName: string
  originalName: string
  fileSize: number
  mimeType: string
  fileUrl: string
  uploadedById: string
  createdAt: string

  uploadedBy: {
    id: string
    nickname: string
    profileImageUrl?: string
  }
}

export interface CreateWorkTaskData {
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  assigneeId?: string
}

export interface UpdateWorkTaskData {
  title?: string
  description?: string
  status?: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  assigneeId?: string
}

export interface CreateSubTaskData {
  title: string
  description?: string
  status?: 'todo' | 'in_progress' | 'review' | 'done'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  assigneeId?: string
  position?: number
}

export interface UpdateSubTaskData {
  title?: string
  description?: string
  status?: 'todo' | 'in_progress' | 'review' | 'done'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  assigneeId?: string
  position?: number
}

// Backend API Response 타입 정의
interface APIResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

interface WorkTasksResponse {
  workTasks: WorkTask[]
}

export const workTasksAPI = {
  /**
   * Get all work tasks for the authenticated user
   */
  async getWorkTasks(creatorOnly: boolean = false): Promise<WorkTask[]> {
    try {
      const queryParams = creatorOnly ? '?creatorOnly=true' : ''
      const response = await api.get(`/api/work-tasks${queryParams}`) as APIResponse<WorkTasksResponse>

      // 표준 백엔드 응답 형식 처리
      if (response?.success && response.data?.workTasks) {
        return response.data.workTasks
      }

      // 응답이 직접 배열인 경우 (레거시 지원)
      if (Array.isArray(response)) {
        return response as WorkTask[]
      }

      // 예상치 못한 응답 구조 로깅 및 빈 배열 반환
      console.warn('[workTasksAPI] Unexpected response structure:', response)
      return []
    } catch (error) {
      // 500 에러에 대한 특별 처리
      if (error instanceof Error && error.message.includes('500')) {
        console.error('[workTasksAPI] Server error (500) - Backend service may be down:', error)
        // 사용자에게 서버 오류임을 알리기 위해 에러를 throw
        throw new Error('서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')
      }
      console.error('[workTasksAPI] Error fetching work tasks:', error)
      // 에러가 발생해도 빈 배열 반환하여 앱이 크래시되지 않도록 함
      return []
    }
  },

  /**
   * Get a specific work task by ID
   */
  async getWorkTask(id: string): Promise<WorkTask> {
    const response = await api.get(`/api/work-tasks/${id}`)
    return response.data || response
  },

  /**
   * Create a new work task
   */
  async createWorkTask(data: CreateWorkTaskData): Promise<WorkTask> {
    try {
      const response = await api.post('/api/work-tasks', data) as APIResponse<WorkTask>

      // 표준 백엔드 응답 형식 처리
      if (response?.success && response.data) {
        return response.data
      }

      // 직접 업무 객체가 반환된 경우 (레거시 지원)
      if (response && 'id' in response && 'title' in response) {
        return response as unknown as WorkTask
      }

      // 응답 오류 시 예외 발생
      throw new Error(response?.message || response?.error || '업무 생성에 실패했습니다')
    } catch (error) {
      console.error('[workTasksAPI] Error creating work task:', error)

      // APIError 인스턴스 체크
      if (error instanceof APIError) {
        // 500 에러 처리
        if (error.status === 500) {
          throw new Error('서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')
        }
        // 400번대 에러 처리
        if (error.status >= 400 && error.status < 500) {
          const errorData = error.data as any
          throw new Error(errorData?.message || errorData?.error || '업무 생성에 실패했습니다.')
        }
      }

      // 기타 에러
      throw error
    }
  },

  /**
   * Update an existing work task
   */
  async updateWorkTask(id: string, data: UpdateWorkTaskData): Promise<WorkTask> {
    return api.patch(`/api/work-tasks/${id}`, data)
  },

  /**
   * Delete a work task
   */
  async deleteWorkTask(id: string): Promise<void> {
    return api.delete(`/api/work-tasks/${id}`)
  },

  /**
   * Join a work task using invite code
   */
  async joinWorkTask(inviteCode: string): Promise<WorkTask> {
    return api.post('/api/work-tasks/join', { inviteCode })
  },

  /**
   * Add a participant to work task
   */
  async addParticipant(taskId: string, userId: string, role: string = 'member'): Promise<WorkTaskParticipant> {
    return api.post(`/api/work-tasks/${taskId}/participants`, { userId, role })
  },

  /**
   * Remove a participant from work task
   */
  async removeParticipant(taskId: string, participantId: string): Promise<void> {
    return api.delete(`/api/work-tasks/${taskId}/participants/${participantId}`)
  },

  /**
   * Add a comment to work task
   */
  async addComment(taskId: string, content: string): Promise<WorkTaskComment> {
    return api.post(`/api/work-tasks/${taskId}/comments`, { content })
  },

  /**
   * Update a comment
   */
  async updateComment(taskId: string, commentId: string, content: string): Promise<WorkTaskComment> {
    return api.patch(`/api/work-tasks/${taskId}/comments/${commentId}`, { content })
  },

  /**
   * Delete a comment
   */
  async deleteComment(taskId: string, commentId: string): Promise<void> {
    return api.delete(`/api/work-tasks/${taskId}/comments/${commentId}`)
  },

  // ===== SubTask Methods =====

  /**
   * Get all subtasks for a work task
   */
  async getSubTasks(workTaskId: string): Promise<SubTask[]> {
    try {
      const response = await api.get(`/api/work-tasks/${workTaskId}/subtasks`) as any

      // Handle standard backend response format
      if (response?.success && response.data) {
        return Array.isArray(response.data) ? response.data : []
      }

      // Backend returns array directly (legacy support)
      if (Array.isArray(response)) {
        return response
      }

      console.warn('[workTasksAPI] Unexpected subtask response structure:', response)
      return []
    } catch (error) {
      console.error('[workTasksAPI] Error fetching subtasks:', error)
      return []
    }
  },

  /**
   * Create a new subtask
   */
  async createSubTask(workTaskId: string, data: CreateSubTaskData): Promise<SubTask> {
    return api.post(`/api/work-tasks/${workTaskId}/subtasks`, data)
  },

  /**
   * Update an existing subtask
   */
  async updateSubTask(workTaskId: string, subtaskId: string, data: UpdateSubTaskData): Promise<SubTask> {
    return api.patch(`/api/work-tasks/${workTaskId}/subtasks/${subtaskId}`, data)
  },

  /**
   * Delete a subtask
   */
  async deleteSubTask(workTaskId: string, subtaskId: string): Promise<void> {
    return api.delete(`/api/work-tasks/${workTaskId}/subtasks/${subtaskId}`)
  },

  /**
   * Get all comments for a subtask
   */
  async getSubTaskComments(workTaskId: string, subtaskId: string): Promise<SubTaskComment[]> {
    try {
      const response = await api.get(`/api/work-tasks/${workTaskId}/subtasks/${subtaskId}/comments`) as SubTaskComment[]

      // Backend returns array directly
      if (Array.isArray(response)) {
        return response
      }

      console.warn('[workTasksAPI] Unexpected subtask comments response structure:', response)
      return []
    } catch (error) {
      console.error('[workTasksAPI] Error fetching subtask comments:', error)
      return []
    }
  },

  /**
   * Add a comment to subtask
   */
  async addSubTaskComment(workTaskId: string, subtaskId: string, content: string): Promise<SubTaskComment> {
    return api.post(`/api/work-tasks/${workTaskId}/subtasks/${subtaskId}/comments`, { content })
  },

  /**
   * Update a subtask comment
   */
  async updateSubTaskComment(
    workTaskId: string,
    subtaskId: string,
    commentId: string,
    content: string
  ): Promise<SubTaskComment> {
    return api.patch(`/api/work-tasks/${workTaskId}/subtasks/${subtaskId}/comments/${commentId}`, { content })
  },

  /**
   * Delete a subtask comment
   */
  async deleteSubTaskComment(workTaskId: string, subtaskId: string, commentId: string): Promise<void> {
    return api.delete(`/api/work-tasks/${workTaskId}/subtasks/${subtaskId}/comments/${commentId}`)
  },

  // ===== SubTask Attachment Methods =====

  /**
   * Get all attachments for a subtask
   */
  async getSubTaskAttachments(workTaskId: string, subtaskId: string): Promise<SubTaskAttachment[]> {
    try {
      const response = await api.get(`/api/work-tasks/${workTaskId}/subtasks/${subtaskId}/attachments`) as SubTaskAttachment[]

      // Backend returns array directly
      if (Array.isArray(response)) {
        return response
      }

      console.warn('[workTasksAPI] Unexpected subtask attachments response structure:', response)
      return []
    } catch (error) {
      console.error('[workTasksAPI] Error fetching subtask attachments:', error)
      return []
    }
  },

  /**
   * Upload a file to subtask
   */
  async uploadSubTaskAttachment(workTaskId: string, subtaskId: string, file: File): Promise<SubTaskAttachment> {
    const formData = new FormData()
    formData.append('file', file)

    // Use fetch directly for file upload instead of the api client
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/work-tasks/${workTaskId}/subtasks/${subtaskId}/attachments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || '파일 업로드에 실패했습니다.')
    }

    return response.json()
  },

  /**
   * Download a subtask attachment
   */
  async downloadSubTaskAttachment(workTaskId: string, subtaskId: string, attachmentId: string): Promise<Blob> {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/work-tasks/${workTaskId}/subtasks/${subtaskId}/attachments/${attachmentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || '파일 다운로드에 실패했습니다.')
    }

    return response.blob()
  },

  /**
   * Delete a subtask attachment
   */
  async deleteSubTaskAttachment(workTaskId: string, subtaskId: string, attachmentId: string): Promise<void> {
    return api.delete(`/api/work-tasks/${workTaskId}/subtasks/${subtaskId}/attachments/${attachmentId}`)
  },

  // ===== SubTask Participant Methods =====

  /**
   * Add a participant to subtask
   */
  async addSubTaskParticipant(workTaskId: string, subtaskId: string, userId: string): Promise<SubTaskParticipant> {
    return api.post(`/api/work-tasks/${workTaskId}/subtasks/${subtaskId}/participants`, { userId })
  },

  /**
   * Remove a participant from subtask
   */
  async removeSubTaskParticipant(workTaskId: string, subtaskId: string, userId: string): Promise<void> {
    return api.delete(`/api/work-tasks/${workTaskId}/subtasks/${subtaskId}/participants?userId=${userId}`)
  },

  // ===== SubTask 전용 조회 API =====

  /**
   * Get all subtasks for the authenticated user across all work tasks
   */
  async getAllSubTasks(): Promise<SubTask[]> {
    try {
      const response = await api.get('/api/subtasks') as any

      // Handle standard backend response format
      if (response?.success && response.data) {
        return Array.isArray(response.data) ? response.data : []
      }

      // Backend returns array directly (legacy support)
      if (Array.isArray(response)) {
        return response
      }

      console.warn('[workTasksAPI] Unexpected getAllSubTasks response structure:', response)
      return []
    } catch (error) {
      console.error('[workTasksAPI] Error fetching all subtasks:', error)
      return []
    }
  }
}