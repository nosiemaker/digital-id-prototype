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
    getMyCertificates: async (): Promise<{ details: string; certificates: any[] }> => {
    const { data } = await axiosInstance.get('/births/my_certificates');
    return data;
  },
    reviewDocuments: async (id: number): Promise<Response> => {
    return axiosInstance.get(`/births/${id}/review`, {
      responseType: 'arraybuffer',
    });
  },
    viewCertificate: async (id: number): Promise<Response> => {
    return axiosInstance.get(`/births/${id}/view/certificate`, {
      responseType: 'arraybuffer',
    });
  },
    reviewFullPack: async (id: number): Promise<Response> => {
    return axiosInstance.get(`/births/${id}/review/full_pack`, {
      responseType: 'arraybuffer',
    });
  },
  getAllApproved: async (): Promise<{ details: string; records: any[] }> => {
  const { data } = await axiosInstance.get('/births/all/approved');
  return data;
},
getMySubmissions: async (): Promise<{ details: string; records: any[] }> => {
  const { data } = await axiosInstance.get('/births/my_submissions');
  return data;
},
};
