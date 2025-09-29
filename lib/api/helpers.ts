/**
 * Common helper functions for API calls
 */

import Cookies from 'js-cookie';

/**
 * Get authentication headers for API requests
 */
export function getAuthHeaders(): HeadersInit {
  const token = Cookies.get('token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Get multipart form data headers (without Content-Type)
 */
export function getAuthHeadersForFormData(): HeadersInit {
  const token = Cookies.get('token') || localStorage.getItem('token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}