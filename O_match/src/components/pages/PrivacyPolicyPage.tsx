import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <main className="pt-24 pb-24 px-4 md:px-8 max-w-4xl mx-auto">
      <section className="glass-card rounded-[2rem] p-8 md:p-12 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)]">
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface mb-3">隐私政策</h1>
        <p className="text-on-surface-variant text-sm mb-8">更新日期：2026-04-14</p>

        <div className="space-y-8 text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">1. 我们收集的信息</h2>
            <p>
              为提供服务，我们会收集你主动提交的信息，包括邮箱、昵称、问卷答案、匹配偏好，以及你在平台内产生的
              必要使用数据（如登录状态、基础操作日志）。
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">2. 信息使用目的</h2>
            <p>
              我们仅在必要范围内使用你的信息，用于账号认证、问卷保存、匹配计算、结果通知、服务优化与安全风控。
              未经你的授权，我们不会将你的个人信息用于与本服务无关的用途。
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">3. 信息存储与安全</h2>
            <p>
              我们会采取合理的技术与管理措施保护你的数据，降低未经授权访问、泄露或篡改风险。
              同时你也应妥善保管账号凭证，避免共享账号信息。
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">4. 信息共享与披露</h2>
            <p>
              除法律法规要求、履行服务所必需，或获得你明确授权外，我们不会向第三方出售或提供你的个人信息。
              在接入短信、邮件等能力时，仅会传递实现通知所必需的最小信息。
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">5. 你的权利</h2>
            <p>
              你可在平台内查看、修改个人资料及相关偏好；也可通过注销账号请求删除数据。
              在法律允许范围内，我们会尽快响应你的隐私相关请求。
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">6. 未成年人保护</h2>
            <p>
              如你未满法定年龄，请在监护人指导下使用本服务。我们建议监护人关注未成年人使用行为与信息保护。
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">7. 政策更新</h2>
            <p>
              随业务发展与合规要求变化，本政策可能更新。更新后将在平台公示，继续使用本服务即视为你已知悉并同意更新内容。
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-orange-100/30 flex items-center justify-between text-sm">
          <Link to="/register" className="text-secondary font-bold hover:opacity-80 transition-opacity">返回注册</Link>
          <Link to="/terms" className="text-primary font-bold hover:underline underline-offset-4">查看服务条款</Link>
        </div>
      </section>
    </main>
  );
};

export default PrivacyPolicyPage;
