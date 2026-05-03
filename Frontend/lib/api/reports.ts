import { axiosInstance } from "@/lib/http"
import type { ReportsSummaryParams, ReportsSummaryResponse, LogExportRequest } from "@/utils/types"

export const reportsApi = {
  getSummary: async (params: ReportsSummaryParams): Promise<ReportsSummaryResponse> => {
    const { data } = await axiosInstance.get("/reports/summary", { params })
    return data
  },

  logExport: async (payload: LogExportRequest): Promise<{ status: string; message: string }> => {
    const { data } = await axiosInstance.post("/reports/log-export", payload)
    return data
  }
}