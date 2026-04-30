import { axiosInstance } from '../http';
import type {
  KYCRequestCreate,
  KYCRequestResponse,
  KYCCitizenResponse,
  ConsentRecordResponse,
  ApprovedCitizenDataResponse,
  StatisticsResponse,
} from '../../utils/types';

export const kycApi = {
  initiateRequest: async (body: KYCRequestCreate): Promise<KYCRequestResponse> => {
    const { data } = await axiosInstance.post<KYCRequestResponse>('/kyc/request', body);
    return data;
  },

  respond: async (kycRequestId: number, body: KYCCitizenResponse): Promise<ConsentRecordResponse> => {
    const { data } = await axiosInstance.post<ConsentRecordResponse>(`/kyc/${kycRequestId}/respond`, body);
    return data;
  },

  getApprovedData: async (kycRequestId: number): Promise<ApprovedCitizenDataResponse> => {
    const { data } = await axiosInstance.get<ApprovedCitizenDataResponse>(`/kyc/${kycRequestId}/data`);
    return data;
  },

  getStatistics: async (): Promise<StatisticsResponse> => {
    const { data } = await axiosInstance.get<StatisticsResponse>('/kyc/statistics');
    return data;
  },
};
