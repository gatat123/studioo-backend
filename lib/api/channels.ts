import { apiClient } from './client'

export interface Channel {
  id: string
  name: string
  description?: string
  type: 'public' | 'private' | 'direct'
  creatorId: string
  creator_id: string
  studio_id?: string
  workTaskId?: string
  is_archived: boolean
  created_at: string
  updated_at: string
  workTask?: {
    id: string
    title: string
    description?: string
    status: string
    priority: string
    dueDate?: string
    createdById?: string
    position?: number
    createdAt: string
    updatedAt: string
  }
  _count?: {
    members: number
    messages: number
  }
}

export interface ChannelMember {
  id: string
  channelId: string
  userId: string
  role: 'admin' | 'moderator' | 'member'
  joinedAt: string
  lastReadAt?: string
  user: {
    id: string
    username: string
    nickname: string
    profile_image_url?: string
    bio?: string
    lastLoginAt?: string
    isActive: boolean
    isOnline?: boolean
  }
}

export interface ChannelMessage {
  id: string
  channelId: string
  senderId: string
  content: string
  type: 'text' | 'image' | 'file' | 'system'
  metadata?: Record<string, unknown>
  editedAt?: string
  deletedAt?: string
  created_at?: string  // Frontend uses this
  createdAt?: string   // Backend sends this
  sender: {
    id: string
    username: string
    nickname: string
    profile_image_url?: string
    profileImageUrl?: string  // Backend might send this
  }
  files?: ChannelFile[]
}

export interface ChannelFile {
  id: string
  channelId: string
  messageId?: string
  uploaderId: string
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface CreateChannelData {
  name: string
  description?: string
  type?: 'public' | 'private'
  studio_id?: string
}

export interface SendMessageData {
  content: string
  type?: 'text' | 'image' | 'file'
  metadata?: Record<string, unknown>
}

export interface InviteMemberData {
  userId: string
  message?: string
}

export interface ChannelInvitation {
  id: string
  channelId: string
  inviterId: string
  inviteeId: string
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  expiresAt?: string
  acceptedAt?: string
  created_at: string
  channel: {
    id: string
    name: string
    description?: string
    type: string
    creator?: {
      id: string
      username: string
      nickname: string
      profile_image_url?: string
    }
    _count?: {
      members: number
      messages: number
    }
  }
  inviter: {
    id: string
    username: string
    nickname: string
    profile_image_url?: string
  }
}

export interface ChannelsResponse {
  channels: Channel[]
  pendingInvites: ChannelInvitation[]
}

// Channel APIs
export const channelsAPI = {
  // Get all channels (for current user)
  getChannels: async (): Promise<ChannelsResponse> => {
    const response = await apiClient.get('/api/channels') as ChannelsResponse
    return {
      channels: response.channels || [],
      pendingInvites: response.pendingInvites || []
    }
  },

  // Create a new channel
  createChannel: async (data: CreateChannelData): Promise<Channel> => {
    const response = await apiClient.post('/api/channels', data) as { channel: Channel }
    return response.channel
  },

  // Get channel details
  getChannel: async (channelId: string): Promise<Channel> => {
    const response = await apiClient.get(`/api/channels/${channelId}`) as { channel: Channel }
    return response.channel
  },

  // Get channel members
  getMembers: async (channelId: string): Promise<ChannelMember[]> => {
    const response = await apiClient.get(`/api/channels/${channelId}/members`) as { members?: ChannelMember[] }
    return response.members || []
  },

  // Invite member to channel
  inviteMember: async (channelId: string, data: InviteMemberData) => {
    const response = await apiClient.post(`/api/channels/${channelId}/members`, data) as { invite: ChannelInvitation }
    return response.invite
  },

  // Leave channel
  leaveChannel: async (channelId: string) => {
    return await apiClient.delete(`/api/channels/${channelId}/members`)
  },

  // Get channel messages
  getMessages: async (channelId: string, limit = 50, cursor?: string): Promise<{
    messages: ChannelMessage[]
    hasMore: boolean
    nextCursor?: string
  }> => {
    const params = new URLSearchParams()
    params.append('limit', limit.toString())
    if (cursor) params.append('cursor', cursor)
    
    return await apiClient.get(`/api/channels/${channelId}/messages?${params}`)
  },

  // Send message to channel
  sendMessage: async (channelId: string, data: SendMessageData): Promise<ChannelMessage> => {
    const response = await apiClient.post(`/api/channels/${channelId}/messages`, data) as { message: ChannelMessage }
    return response.message
  },

  // Upload file to channel
  uploadFile: async (channelId: string, file: File, messageId?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (messageId) formData.append('messageId', messageId)
    
    const response = await apiClient.post(`/api/channels/${channelId}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }) as { file: { url: string; name: string; size: number } }
    return response.file
  },

  // Accept channel invite
  acceptInvite: async (inviteId: string) => {
    return await apiClient.post(`/api/channels/invitations/${inviteId}/accept`)
  },

  // Reject channel invite
  rejectInvite: async (inviteId: string) => {
    return await apiClient.post(`/api/channels/invitations/${inviteId}/reject`)
  },

  // Get pending invites
  getPendingInvites: async () => {
    const response = await apiClient.get('/api/channels/invitations') as { invitations?: ChannelInvitation[] }
    return response.invitations || []
  },

  // Delete channel (admin only)
  deleteChannel: async (channelId: string): Promise<void> => {
    await apiClient.delete(`/api/channels/${channelId}`)
  }
}