import { axiosInstance } from '../http';
import type { QRPayload, QRVerifyRequest, QRVerifyResponse } from '../../utils/types';

export const qrApi = {
  generate: async (din: string): Promise<QRPayload> => {
    const { data } = await axiosInstance.post<QRPayload>(`/qr/${din}/generate`);
    return data;
  },

  verify: async (body: QRVerifyRequest): Promise<QRVerifyResponse> => {
    const { data } = await axiosInstance.post<QRVerifyResponse>('/qr/verify', body);
    return data;
  },
};
