import { axiosInstance } from '../http';

export interface AuditLog {
  id: number;
  actor_id: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  outcome: string;
  ip_address?: string | null;
  metastamp?: Record<string, any> | null;
  timestamp: string;
}

export interface PaginatedAuditLogs {
  total: number;
  page: number;
  page_size: number;
  results: AuditLog[];
}

export const auditApi = {
  getMyLogs: async (page = 1, pageSize = 20) => {
    const response = await axiosInstance.get<PaginatedAuditLogs>('/audit_logs/me', {
      params: { page, page_size: pageSize },
    });
    return response.data;
  },

};
