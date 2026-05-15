import { create } from 'zustand';
import type { Match, MatchReportData } from '@/types';
import { getUserMatchReport } from '@/services/matchingService';

interface MatchState {
  currentMatch: Match | null;
  nextMatchTime: string;
  isJoined: boolean;
  isLoading: boolean;
  matchReport: MatchReportData | null;
  reportLoading: boolean;

  setCurrentMatch: (match: Match | null) => void;
  setNextMatchTime: (time: string) => void;
  setIsJoined: (joined: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  clearMatch: () => void;
  fetchMatchReport: () => Promise<void>;
}

export const useMatchStore = create<MatchState>((set) => ({
  currentMatch: null,
  nextMatchTime: '',
  isJoined: false,
  isLoading: false,
  matchReport: null,
  reportLoading: false,

  setCurrentMatch: (match) => set({ currentMatch: match }),
  setNextMatchTime: (time) => set({ nextMatchTime: time }),
  setIsJoined: (joined) => set({ isJoined: joined }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  clearMatch: () =>
    set({
      currentMatch: null,
      isJoined: false,
      matchReport: null,
    }),

  fetchMatchReport: async () => {
    set({ reportLoading: true });
    try {
      const report = await getUserMatchReport();
      set({ matchReport: report, reportLoading: false });
    } catch {
      set({ matchReport: null, reportLoading: false });
    }
  },
}));