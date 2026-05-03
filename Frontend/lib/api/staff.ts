import { axiosInstance } from "@/lib/http"
import type { HealthWorkerPayload, RegistrationOfficerPayload, StaffMember } from "@/utils/types"

export const staffApi = {
  getAll: async (): Promise<{ details: string; staff: StaffMember[] }> => {
    const { data } = await axiosInstance.get("/users/staff")
    return data
  },
  addHealthWorker: async (payload: HealthWorkerPayload) => {
    const { data } = await axiosInstance.put("/users/add_permission/health-worker", payload)
    return data
  },
  addRegistrationOfficer: async (payload: RegistrationOfficerPayload) => {
    const { data } = await axiosInstance.put("/users/add_permission/registration-officer", payload)
    return data
  },
  removeHealthWorker: async (din: string) => {
    const { data } = await axiosInstance.put("/users/remove_permission/health-worker", { citizen_din: din })
    return data
  },
  removeRegistrationOfficer: async (din: string) => {
    const { data } = await axiosInstance.put("/users/remove_permission/registration-officer", { citizen_din: din })
    return data
  }
}