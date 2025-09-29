import { apiClient } from './client'

export interface Friend {
  id: string
  username: string
  nickname: string
  profileImageUrl?: string
  bio?: string
  memo?: string
  lastLoginAt?: string
  isActive: boolean
  friendshipId: string
  createdAt: string
}

export interface FriendRequest {
  id: string
  senderId: string
  receiverId: string
  message?: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
  sender?: {
    id: string
    username: string
    nickname: string
    profileImageUrl?: string
  }
  receiver?: {
    id: string
    username: string
    nickname: string
    profileImageUrl?: string
  }
}

// Friends APIs
export const friendsAPI = {
  // Get friends list
  getFriends: async (): Promise<Friend[]> => {
    try {
      const response = await apiClient.get('/api/friends') as {
        success?: boolean
        friends?: Array<{
          id: string
          friend: Friend & { isOnline?: boolean }
          memo?: string
          createdAt: string
        }>
        receivedRequests?: FriendRequest[]
        sentRequests?: FriendRequest[]
      }

      // The API returns { success: true, friends: [...], receivedRequests: [...], sentRequests: [...] }
      if (response && response.friends) {
        // Transform the response to match Friend interface
        return response.friends.map((friendship) => ({
          id: friendship.friend.id,
          username: friendship.friend.username,
          nickname: friendship.friend.nickname,
          profileImageUrl: friendship.friend.profileImageUrl,
          bio: friendship.friend.bio,
          memo: friendship.memo,
          lastLoginAt: friendship.friend.lastLoginAt,
          isActive: friendship.friend.isActive || friendship.friend.isOnline,
          friendshipId: friendship.id,
          createdAt: friendship.createdAt
        }))
      }
      
      return []
    } catch {
      // Failed to get friends
      return []
    }
  },

  // Search friends
  searchFriends: async (query: string): Promise<Friend[]> => {
    const response = await apiClient.get(`/api/friends/search?q=${encodeURIComponent(query)}`) as { data: { friends: Friend[] } }
    return response.data.friends
  },

  // Send friend request
  sendFriendRequest: async (userId: string, message?: string) => {
    const response = await apiClient.post('/api/friends/request', { userId, message }) as { data: FriendRequest }
    return response.data
  },

  // Accept friend request
  acceptFriendRequest: async (requestId: string) => {
    const response = await apiClient.post(`/api/friends/requests/${requestId}/accept`) as { data: Friend }
    return response.data
  },

  // Reject friend request
  rejectFriendRequest: async (requestId: string) => {
    const response = await apiClient.post(`/api/friends/requests/${requestId}/reject`) as { data: { success: boolean } }
    return response.data
  },

  // Get pending friend requests
  getPendingRequests: async (): Promise<{
    sent: FriendRequest[]
    received: FriendRequest[]
  }> => {
    const response = await apiClient.get('/api/friends/requests') as {
      data: { sent: FriendRequest[], received: FriendRequest[] }
    }
    return response.data
  },

  // Remove friend
  removeFriend: async (friendId: string) => {
    const response = await apiClient.delete(`/api/friends/${friendId}`) as { data: { success: boolean } }
    return response.data
  },

  // Update friend memo
  updateFriendMemo: async (friendId: string, memo: string) => {
    const response = await apiClient.patch(`/api/friends/${friendId}/memo`, { memo }) as { data: { success: boolean } }
    return response.data
  }
}