import apiClient from '../../../lib/axios';

interface UploadUrlResponse {
  success: true;
  data: { uploadUrl: string; fileId: string; key: string };
}

interface ConfirmResponse {
  success: true;
  data: { publicUrl: string };
}

export const filesApi = {
  async requestUploadUrl(params: {
    filename: string;
    mimeType: string;
    size: number;
  }): Promise<{ uploadUrl: string; fileId: string; key: string }> {
    const res = await apiClient.post<UploadUrlResponse>('/files/upload-url', params);
    return res.data.data;
  },

  async confirmUpload(fileId: string): Promise<{ publicUrl: string }> {
    const res = await apiClient.post<ConfirmResponse>(`/files/${fileId}/confirm`);
    return res.data.data;
  },
};
