import { axiosInstance } from '../http';
import type { ProvinceOption, DistrictOption } from '../../utils/types';

export const referenceApi = {
  getProvinces: async (): Promise<ProvinceOption[]> => {
    const { data } = await axiosInstance.get<ProvinceOption[]>('/districts/provinces');
    return data;
  },

  getDistricts: async (province_code?: string): Promise<DistrictOption[]> => {
    const { data } = await axiosInstance.get<DistrictOption[]>('/districts/', {
      params: province_code ? { province_code } : undefined,
    });
    return data;
  },
};
