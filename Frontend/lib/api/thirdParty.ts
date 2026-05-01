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
};
