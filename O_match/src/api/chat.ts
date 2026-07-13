import apiClient from './client';
import type { ApiResponse } from '@/types';

// 冰破聊天 API（结构化破冰替代自由聊天）
export const chatApi = {
  // 获取当前匹配的冰破状态
  getRoundStatus: (matchId: string) =>
    apiClient.get<ApiResponse<{
      currentRound: number;
      myReplies: Record<number, string>;
      partnerReplies: Record<number, { id: string; content: string; createdAt: string }>;
      partnerConfirmed: boolean;
      iConfirmed: boolean;
    }>>(`/chat/round-status/${matchId}`),

  // 提交一轮冰破回复
  submitReply: (matchId: string, round: number, content: string) =>
    apiClient.post<ApiResponse<{ id: string; createdAt: string }>>('/chat/submit-reply', {
      matchId,
      round,
      content,
    }),

  // Round 3 确认交换联系方式
  confirmConnection: (matchId: string) =>
    apiClient.post<ApiResponse<{ partnerContact?: { platform: string; value: string }[] }>>(
      '/chat/confirm-connection',
      { matchId }
    ),

  // 标记消息已读（保留兼容）
  markAsRead: (matchId: string) =>
    apiClient.post<ApiResponse<null>>(`/chat/read/${matchId}`, {}),
};

export default chatApi;
