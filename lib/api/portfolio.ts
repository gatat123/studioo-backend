import { getAuthHeaders } from '@/lib/api/helpers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface PortfolioProject {
  id: string;
  name: string;
  description?: string;
  thumbnail: string;
  images: string[];
  category: string;
  tags: string[];
  likes: number;
  views: number;
  isLiked: boolean;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
  tools?: string[];
  link?: string;
  behanceUrl?: string;
  dribbbleUrl?: string;
}

export interface PortfolioProfile {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  coverImage?: string;
  location?: string;
  website?: string;
  social: {
    instagram?: string;
    twitter?: string;
    behance?: string;
    dribbble?: string;
    github?: string;
    linkedin?: string;
  };
  stats: {
    projects: number;
    likes: number;
    views: number;
    followers: number;
    following: number;
  };
  categories: string[];
  isFollowing: boolean;
  isOwner: boolean;
}

// Get portfolio profile
export async function getPortfolioProfile(username: string): Promise<PortfolioProfile> {
  const response = await fetch(`${API_URL}/portfolio/${username}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch portfolio profile');
  }

  return response.json();
}

// Get portfolio projects
export async function getPortfolioProjects(
  username: string,
  options?: {
    category?: string;
    tags?: string[];
    sortBy?: 'latest' | 'popular' | 'views';
    page?: number;
    limit?: number;
  }
): Promise<{ projects: PortfolioProject[]; total: number }> {
  const params = new URLSearchParams();

  if (options?.category) params.append('category', options.category);
  if (options?.tags) options.tags.forEach(tag => params.append('tags', tag));
  if (options?.sortBy) params.append('sortBy', options.sortBy);
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());

  const response = await fetch(`${API_URL}/portfolio/${username}/projects?${params}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch portfolio projects');
  }

  return response.json();
}

// Update portfolio profile
export async function updatePortfolioProfile(
  username: string,
  data: Partial<PortfolioProfile>
): Promise<PortfolioProfile> {
  const response = await fetch(`${API_URL}/portfolio/${username}`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update portfolio profile');
  }

  return response.json();
}

// Star/unstar project
export async function toggleProjectStar(projectId: string): Promise<{ isStarred: boolean }> {
  const response = await fetch(`${API_URL}/projects/${projectId}/star`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to toggle star');
  }

  return response.json();
}

// Like/unlike project
export async function toggleProjectLike(projectId: string): Promise<{ isLiked: boolean; likes: number }> {
  const response = await fetch(`${API_URL}/projects/${projectId}/like`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to toggle like');
  }

  return response.json();
}

// Follow/unfollow user
export async function toggleFollow(username: string): Promise<{ isFollowing: boolean }> {
  const response = await fetch(`${API_URL}/users/${username}/follow`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to toggle follow');
  }

  return response.json();
}

// Update project visibility
export async function updateProjectVisibility(
  projectId: string,
  isPublic: boolean
): Promise<void> {
  const response = await fetch(`${API_URL}/projects/${projectId}/visibility`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isPublic }),
  });

  if (!response.ok) {
    throw new Error('Failed to update project visibility');
  }
}

// Get starred projects
export async function getStarredProjects(
  username: string,
  page: number = 1,
  limit: number = 12
): Promise<{ projects: PortfolioProject[]; total: number }> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  const response = await fetch(`${API_URL}/portfolio/${username}/starred?${params}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch starred projects');
  }

  return response.json();
}

// Upload portfolio cover image
export async function uploadCoverImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${API_URL}/portfolio/cover`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload cover image');
  }

  return response.json();
}