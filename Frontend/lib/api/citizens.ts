import { axiosInstance } from '../http';
import type {
  CitizenStatus,
  Language,
  CitizenSummary,
  CitizenResponse,
  CitizenUpdate,
  BiometricRecordResponse,
  FamilyLinkBase,
  FamilyLinkResponse,
  FamilyTreeResponse,
} from '../../utils/types';

export const citizenApi = {
  list: async (params?: {
    status?: CitizenStatus;
    language?: Language;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<CitizenSummary[]> => {
    const { data } = await axiosInstance.get<CitizenSummary[]>('/citizens/', { params });
    return data;
  },

  get: async (din: string): Promise<CitizenResponse> => {
    const { data } = await axiosInstance.get<CitizenResponse>(`/citizens/${din}`);
    return data;
  },

  update: async (din: string, body: CitizenUpdate): Promise<CitizenResponse> => {
    const { data } = await axiosInstance.patch<CitizenResponse>(`/citizens/${din}`, body);
    return data;
  },

  delete: async (din: string): Promise<void> => {
    await axiosInstance.delete(`/citizens/${din}`);
  },

  getBiometrics: async (din: string): Promise<BiometricRecordResponse> => {
    const { data } = await axiosInstance.get<BiometricRecordResponse>(`/citizens/${din}/biometrics`);
    return data;
  },

  createBiometrics: async (din: string, body: { facial_template?: string }): Promise<BiometricRecordResponse> => {
    const { data } = await axiosInstance.post<BiometricRecordResponse>(`/citizens/${din}/biometrics`, body);
    return data;
  },

  updateBiometrics: async (din: string, body: { facial_template?: string }): Promise<BiometricRecordResponse> => {
    const { data } = await axiosInstance.patch<BiometricRecordResponse>(`/citizens/${din}/biometrics`, body);
    return data;
  },

  createFamilyLink: async (din: string, body: FamilyLinkBase): Promise<FamilyLinkResponse> => {
    const { data } = await axiosInstance.post<FamilyLinkResponse>(`/citizens/${din}/family-links`, body);
    return data;
  },

  getFamilyTree: async (din: string): Promise<FamilyTreeResponse> => {
    const { data } = await axiosInstance.get<FamilyTreeResponse>(`/citizens/${din}/family-tree`);
    return data;
  },
};
