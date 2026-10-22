import React, { useEffect, useLayoutEffect } from 'react';
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
  const setModuleProgressSnapshot = useQuestionnaireStore((state) => state.setModuleProgressSnapshot);

  const localSnapshot = getQuestionnaireSnapshot();

  // 在浏览器绘制前同步本地进度；没有数据时也必须归零，避免沿用上一位用户的状态。
  useLayoutEffect(() => {
    setModuleProgressSnapshot(calculateModuleProgress(localSnapshot));
  }, [localSnapshot, setModuleProgressSnapshot]);

  // 路由变化时滚动到顶部
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    const hydrateProgress = async () => {
      const saved = await loadQuestionnaire();
      if (cancelled) {
        return;
      }

      // 远端同样可能没有问卷记录，此时应覆盖为全零进度。
      setModuleProgressSnapshot(calculateModuleProgress(saved));
    };

    void hydrateProgress();

    return () => {
      cancelled = true;
    };
  }, [setModuleProgressSnapshot]);

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
