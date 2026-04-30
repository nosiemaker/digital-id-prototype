import { axiosInstance } from '../http';
import type { DeathRecordBase, PendingDeathSubmission, RecordRejection, DeathRecordApproveResponse } from '../../utils/types';

export const deathRecordApi = {
  submit: async (body: DeathRecordBase): Promise<unknown> => {
    const { data } = await axiosInstance.post('/deaths/submit', body);
    return data;
  },

  getPendingSubmissions: async (): Promise<{ details: string; pending_submissions: PendingDeathSubmission[] }> => {
    const { data } = await axiosInstance.get('/deaths/pending_submissions');
    return data;
  },

  getRecord: async (recordId: number): Promise<{ details: string; record: PendingDeathSubmission }> => {
    const { data } = await axiosInstance.get(`/deaths/record/${recordId}`);
    return data;
  },

  getSubmission: async (recordId: number): Promise<{ details: string; pending_submission: PendingDeathSubmission }> => {
    const { data } = await axiosInstance.get(`/deaths/submission/${recordId}`);
    return data;
  },

  getAll: async (): Promise<{ details: string; records: PendingDeathSubmission[] }> => {
    const { data } = await axiosInstance.get('/deaths/all');
    return data;
  },

  approve: async (submissionId: number): Promise<DeathRecordApproveResponse> => {
    const { data } = await axiosInstance.put(`/deaths/${submissionId}/approve`);
    return data;
  },

  reject: async (submissionId: number, body: RecordRejection): Promise<{ details: string; death_records_id: number; rejection_reason: string; status: number }> => {
    const { data } = await axiosInstance.put(`/deaths/${submissionId}/reject`, body);
    return data;
  },
};
