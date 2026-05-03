import { axiosInstance } from '../http';
import type {
  KYCRequestCreate,
  KYCRequestResponse,
  KYCCitizenResponse,
  ConsentRecordResponse,
  ApprovedCitizenDataResponse,
  StatisticsResponse,
  VerifiedPartnerResponse,
  PartnerLinkResponse,
  InstitutionLinkedCitizenResponse,
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

  getVerifiedPartners: async (): Promise<VerifiedPartnerResponse[]> => {
    const { data } = await axiosInstance.get<VerifiedPartnerResponse[]>('/kyc/partners/verified');
    return data;
  },

  linkPartner: async (institutionId: number): Promise<PartnerLinkResponse> => {
    const { data } = await axiosInstance.post<PartnerLinkResponse>(`/kyc/partners/${institutionId}/link`);
    return data;
  },

  getLinkedPartners: async (): Promise<PartnerLinkResponse[]> => {
    const { data } = await axiosInstance.get<PartnerLinkResponse[]>('/kyc/partners/linked');
    return data;
  },

  getInstitutionLinkedCitizens: async (): Promise<InstitutionLinkedCitizenResponse[]> => {
    const { data } = await axiosInstance.get<InstitutionLinkedCitizenResponse[]>('/kyc/institution/linked-citizens');
    return data;
  },

  getLinkedCitizenProfile: async (din: string): Promise<Record<string, any>> => {
    const { data } = await axiosInstance.get<Record<string, any>>(`/kyc/institution/linked-citizens/${din}/profile`);
    return data;
  },

  lookupCitizen: async (din: string): Promise<{ full_name: string; nrc: string; din: string }> => {
    const { data } = await axiosInstance.get(`/kyc/citizen-lookup/${din}`);
    return data;
  },
};
