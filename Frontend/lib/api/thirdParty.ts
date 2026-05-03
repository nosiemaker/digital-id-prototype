import { axiosInstance } from "../http";
import { ThirdPartyRegistrationRequest } from "../../utils/types";

export const thirdPartyApi = {
  register: async (body: ThirdPartyRegistrationRequest): Promise<unknown> => {
    const { data } = await axiosInstance.post("/third_party/register", body);
    return data;
  },
  getActive: async (): Promise<any[]> => {
    const { data } = await axiosInstance.get("/third_party/active");
    return data;
  },
  getPending: async (): Promise<any[]> => {
    const { data } = await axiosInstance.get("/third_party/pending");
    return data;
  },
  approve: async (requestId: number, permittedScope: string[]): Promise<any> => {
    const { data } = await axiosInstance.put(`/third_party/${requestId}/approve`, {
      permitted_scope: permittedScope
    });
    return data;
  },
  reject: async (requestId: number, reason: string): Promise<any> => {
    const { data } = await axiosInstance.put(`/third_party/${requestId}/reject`, {
      rejection_reason: reason
    });
    return data;
  }
};
