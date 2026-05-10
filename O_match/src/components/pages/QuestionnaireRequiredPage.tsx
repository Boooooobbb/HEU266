import React from 'react';
import { Link } from 'react-router-dom';

const QuestionnaireRequiredPage: React.FC = () => {
  return (
    <main className="pt-24 pb-24 px-4 max-w-3xl mx-auto min-h-[70vh] flex items-center">
      <section className="w-full glass-card rounded-[2rem] p-8 md:p-12 text-center shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)]">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-orange-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-orange-700" style={{ fontVariationSettings: "'FILL' 1" }}>
            assignment
          </span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-on-surface mb-3">先完成问卷，再查看匹配</h1>
        <p className="text-on-surface-variant leading-relaxed mb-8">
          你还没有完成并提交问卷，暂时无法进入“我的匹配”。
          <br />
          先去完成问卷，提交后即可参与并查看匹配进度。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/questionnaire/1"
            className="sunset-gradient text-white font-bold py-5 px-8 rounded-full shadow-lg shadow-orange-700/10 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2"
          >
            继续完成问卷
          </Link>
        </div>
      </section>
    </main>
  );
};

export default QuestionnaireRequiredPage;
