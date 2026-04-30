import { axiosInstance } from '../http';
import type {
  IdentitySubmitRequest,
  IdentitySubmitResponse,
  EnrollmentRequestResponse,
  EnrollmentRejection,
} from '../../utils/types';

export const enrollmentApi = {
  submitIdentity: async (body: IdentitySubmitRequest): Promise<IdentitySubmitResponse> => {
    const { data } = await axiosInstance.post<IdentitySubmitResponse>('/enrollments/submit-identity', body);
    return data;
  },

  getPendingRequests: async (): Promise<EnrollmentRequestResponse[]> => {
    const { data } = await axiosInstance.get<EnrollmentRequestResponse[]>('/enrollments/pending_requests');
    return data;
  },

  getPendingRequest: async (requestId: number): Promise<EnrollmentRequestResponse> => {
    const { data } = await axiosInstance.get<EnrollmentRequestResponse>(`/enrollments/pending_request/${requestId}`);
    return data;
  },

  approve: async (requestId: number): Promise<EnrollmentRequestResponse> => {
    const { data } = await axiosInstance.put<EnrollmentRequestResponse>(`/enrollments/${requestId}/request_approve`);
    return data;
  },

  reject: async (requestId: number, body: EnrollmentRejection): Promise<EnrollmentRequestResponse> => {
    const { data } = await axiosInstance.put<EnrollmentRequestResponse>(`/enrollments/${requestId}/request_reject`, body);
    return data;
  },
};
