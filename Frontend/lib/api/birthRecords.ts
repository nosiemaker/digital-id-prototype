import { axiosInstance } from '../http';
import type { BirthRecordSubmission, PendingBirthSubmission, RecordRejection } from '../../utils/types';

export const birthRecordApi = {
  submit: async (body: BirthRecordSubmission): Promise<{
    details: string;
    birth_records_id: number;
    notice_of_birth_id: number;
    record_of_birth_id: number;
    status: number;
  }> => {
    const { data } = await axiosInstance.post('/births/submit', body);
    return data;
  },

  getPendingSubmissions: async (): Promise<{ details: string; pending_submissions: PendingBirthSubmission[] }> => {
    const { data } = await axiosInstance.get('/births/pending_submissions');
    return data;
  },

  getRecord: async (recordId: number): Promise<{ details: string; record: PendingBirthSubmission }> => {
    const { data } = await axiosInstance.get(`/births/record/${recordId}`);
    return data;
  },

  getSubmission: async (submissionId: number): Promise<{ details: string; pending_submission: PendingBirthSubmission }> => {
    const { data } = await axiosInstance.get(`/births/submission/${submissionId}`);
    return data;
  },

  getAll: async (): Promise<{ details: string; records: PendingBirthSubmission[] }> => {
    const { data } = await axiosInstance.get('/births/all');
    return data;
  },

  approve: async (submissionId: number): Promise<{ details: string; certificate: number; status: number }> => {
    const { data } = await axiosInstance.put(`/births/${submissionId}/approve`);
    return data;
  },

  reject: async (submissionId: number, body: RecordRejection): Promise<{ details: string; request: unknown; status: number }> => {
    const { data } = await axiosInstance.put(`/births/${submissionId}/reject`, body);
    return data;
  },
};
