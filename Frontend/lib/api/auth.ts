import { axiosInstance } from '../http';
import { tokenStore } from '../http';
import type {
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  MeResponse,
  AccountCreateRequest,
  AccountCreateResponse,
  OTPVerifyRequest,
  OTPVerifyResponse,
  ResendOTPRequest,
  ResendOTPResponse,
} from '../../utils/types';

export const authApi = {
  login: async (body: LoginRequest): Promise<LoginResponse> => {
    const { data } = await axiosInstance.post<LoginResponse>('/auth/login', body);
    tokenStore.set(data.access_token, data.refresh_token, data.role, data.name);
    return data;
  },

  refresh: async (refresh_token: string): Promise<RefreshResponse> => {
    const { data } = await axiosInstance.post<RefreshResponse>('/auth/refresh', { refresh_token });
    const currentRole = tokenStore.getRole() || '';
    const currentName = tokenStore.getName() || '';
    tokenStore.set(data.access_token, data.refresh_token, currentRole, currentName);
    return data;
  },

  me: async (): Promise<MeResponse> => {
    const { data } = await axiosInstance.get<MeResponse>('/auth/me');
    if (data.name) tokenStore.setName(data.name);
    if (data.role) tokenStore.setRole(data.role);
    return data;
  },

  updateMe: async (body: { name?: string; phone?: string; language?: string }): Promise<MeResponse> => {
    const { data } = await axiosInstance.put<MeResponse>('/auth/me', body);
    if (data.name) tokenStore.setName(data.name);
    return data;
  },

  logout: async (): Promise<void> => {
    try {
      await axiosInstance.post('/auth/logout');
    } finally {
      tokenStore.clear();
    }
  },

  createAccount: async (body: AccountCreateRequest): Promise<AccountCreateResponse> => {
    const { data } = await axiosInstance.post<AccountCreateResponse>('/enrollments/register', body);
    return data;
  },

  verifyOtp: async (body: OTPVerifyRequest): Promise<OTPVerifyResponse> => {
    const { data } = await axiosInstance.post<OTPVerifyResponse>('/enrollments/verify-otp', body);
    return data;
  },

  resendOtp: async (body: ResendOTPRequest): Promise<ResendOTPResponse> => {
    const { data } = await axiosInstance.post<ResendOTPResponse>('/enrollments/resend-otp', body);
    return data;
  },
};
