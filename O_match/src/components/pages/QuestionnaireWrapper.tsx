import React, { useEffect } from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import QuestionnaireModule1 from './QuestionnaireModule1';
import QuestionnaireModule2 from './QuestionnaireModule2';
import QuestionnaireModule3 from './QuestionnaireModule3';
import QuestionnaireModule4 from './QuestionnaireModule4';
import QuestionnaireModule5 from './QuestionnaireModule5';
import { getQuestionnaireSnapshot, loadQuestionnaire } from '@/services/questionnaireService';
import { calculateModuleProgress } from '@/utils/questionnaireProgress';
import { useQuestionnaireStore } from '@/store';

// 动态问卷页面 - 根据 moduleId 渲染不同模块
const QuestionnairePage: React.FC = () => {
  const { moduleId } = useParams();
  const location = useLocation();
  const currentModule = moduleId ? parseInt(moduleId) : 1;
  const { setModuleProgress } = useQuestionnaireStore();

  const localSnapshot = getQuestionnaireSnapshot();

  useEffect(() => {
    if (!localSnapshot) {
      return;
    }

    const progress = calculateModuleProgress(localSnapshot);
    setModuleProgress(1, progress.module1);
    setModuleProgress(2, progress.module2);
    setModuleProgress(3, progress.module3);
    setModuleProgress(4, progress.module4);
    setModuleProgress(5, progress.module5);
  }, [localSnapshot, setModuleProgress]);

  // 路由变化时滚动到顶部
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    const hydrateProgress = async () => {
      const saved = await loadQuestionnaire();
      if (cancelled || !saved) {
        return;
      }

      const progress = calculateModuleProgress(saved);
      setModuleProgress(1, progress.module1);
      setModuleProgress(2, progress.module2);
      setModuleProgress(3, progress.module3);
      setModuleProgress(4, progress.module4);
      setModuleProgress(5, progress.module5);
    };

    void hydrateProgress();

    return () => {
      cancelled = true;
    };
  }, [setModuleProgress]);

  // 根据模块ID渲染对应的问卷组件
  switch (currentModule) {
    case 1:
      return <QuestionnaireModule1 />;
    case 2:
      return <QuestionnaireModule2 />;
    case 3:
      return <QuestionnaireModule3 />;
    case 4:
      return <QuestionnaireModule4 />;
    case 5:
      return <QuestionnaireModule5 />;
    default:
      return <Navigate to="/questionnaire/1" replace />;
  }
};

export default QuestionnairePage;