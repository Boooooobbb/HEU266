import { create } from 'zustand';
import type { IceReply, IceBreakingRound, IceBreakingState } from '@/types';

interface ChatState extends IceBreakingState {
  isLoading: boolean;
  error: string | null;

  // Actions
  setMatchId: (matchId: string) => void;
  setCurrentRound: (round: IceBreakingRound) => void;
  setMyReply: (round: number, replyId: string) => void;
  setPartnerReply: (round: number, reply: IceReply) => void;
  setPartnerConfirmed: (confirmed: boolean) => void;
  setIConfirmed: (confirmed: boolean) => void;
  setConnected: (connected: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: IceBreakingState = {
  matchId: '',
  currentRound: 1,
  myReplies: {},
  partnerReplies: {},
  partnerConfirmed: false,
  iConfirmed: false,
  connected: false,
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,
  isLoading: false,
  error: null,

  setMatchId: (matchId) => set({ matchId }),
  setCurrentRound: (round) => set({ currentRound: round }),
  setMyReply: (round, replyId) =>
    set((state) => ({
      myReplies: { ...state.myReplies, [round]: replyId },
    })),
  setPartnerReply: (round, reply) =>
    set((state) => ({
      partnerReplies: { ...state.partnerReplies, [round]: reply },
    })),
  setPartnerConfirmed: (confirmed) => set({ partnerConfirmed: confirmed }),
  setIConfirmed: (confirmed) => set({ iConfirmed: confirmed }),
  setConnected: (connected) => set({ connected }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      ...initialState,
      isLoading: false,
      error: null,
    }),
}));
