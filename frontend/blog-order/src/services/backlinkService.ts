import type { BacklinkIntegrationRequest, BacklinkIntegrationResponse } from '../types/backlink';
import { getAuthToken } from './authService';

const API_BASE = `${import.meta.env.VITE_REACT_APP_API_URL}/v${import.meta.env.VITE_REACT_APP_API_VERSION}/articles`;

// Integrate backlink into article content
export async function integrateBacklink(backlinkData: BacklinkIntegrationRequest): Promise<BacklinkIntegrationResponse> {
  const token = getAuthToken();
  if (!token) throw new Error('No authentication token');
  
  const res = await fetch(`${API_BASE}/integrateBacklink`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(backlinkData),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to integrate backlink');
  }
  
  return res.json();
}