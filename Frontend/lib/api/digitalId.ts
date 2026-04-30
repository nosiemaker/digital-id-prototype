import { axiosInstance } from '../http';
import type { DigitalIDResponse, ServerPublicKeyResponse } from '../../utils/types';

export const digitalIdApi = {
  getServerPublicKey: async (): Promise<ServerPublicKeyResponse> => {
    const { data } = await axiosInstance.get<ServerPublicKeyResponse>('/digital-id/server-public-key');
    return data;
  },

  get: async (din: string): Promise<DigitalIDResponse> => {
    const { data } = await axiosInstance.get<DigitalIDResponse>(`/digital-id/${din}`);
    return data;
  },
};
