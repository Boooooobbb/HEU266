import React from 'react';
import { cn } from '@/utils';
import { QuestionnaireSaveStatus } from './QuestionnaireSaveStatus';
import { QUESTIONNAIRE_TOTAL_QUESTIONS } from '@/utils/questionnaireProgress';
import type { QuestionnaireSaveState } from '@/hooks/useQuestionnaireAutoSave';

interface QuestionnaireModuleNavItem {
  id: number;
  name: string;
  icon: string;
}

interface QuestionnaireTopProgressProps {
  modules: QuestionnaireModuleNavItem[];
  currentModule: number;
  totalProgress: number;
  saveState: QuestionnaireSaveState;
  lastSavedAt: number | null;
  onNavigate: (moduleId: number) => void;
  navClassName?: string;
}

export const QuestionnaireTopProgress: React.FC<QuestionnaireTopProgressProps> = ({
  modules,
  currentModule,
  totalProgress,
  saveState,
  lastSavedAt,
  onNavigate,
  navClassName,
}) => {
  return (
    <div className="sticky top-20 z-50 bg-[#fdf9f3] pt-4 pb-4 -mx-4 px-4 -mt-4">
      <div className="flex items-center justify-between mb-4 gap-6">
        <div className="w-full">
          <div className="flex justify-between items-end mb-2">
            <span className="text-on-surface-variant text-sm font-semibold">问卷完成度</span>
            <span className="text-primary font-bold">{totalProgress}/{QUESTIONNAIRE_TOTAL_QUESTIONS}</span>
          </div>
          <QuestionnaireSaveStatus saveState={saveState} lastSavedAt={lastSavedAt} />
          <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-container rounded-full shadow-[0_0_8px_rgba(246,138,47,0.4)] transition-[width] duration-500 ease-out"
              style={{ width: `${(totalProgress / QUESTIONNAIRE_TOTAL_QUESTIONS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className={cn('flex gap-2 overflow-x-auto pb-2 no-scrollbar items-center -mb-2', navClassName)}>
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => onNavigate(module.id)}
            className={cn(
              'whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors',
              currentModule === module.id
                ? 'bg-[#ffdbcd] text-[#a23f00] shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-low'
            )}
          >
            <span className="material-symbols-outlined text-lg">{module.icon}</span>
            {module.name}
          </button>
        ))}
      </div>
    </div>
  );
};
