import React from 'react';
import { Link } from 'react-router-dom';

const TermsOfServicePage: React.FC = () => {
  return (
    <main className="pt-24 pb-24 px-4 md:px-8 max-w-4xl mx-auto">
      <section className="glass-card rounded-[2rem] p-8 md:p-12 shadow-[0_8px_32px_rgba(28,28,24,0.06),0_0_0_1px_rgba(219,194,178,0.2)]">
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface mb-3">服务条款</h1>
        <p className="text-on-surface-variant text-sm mb-8">更新日期：2026-04-14</p>

        <div className="space-y-8 text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">1. 条款适用</h2>
            <p>
              欢迎使用意配（O-Match）。你在注册、登录或使用本服务时，表示你已阅读并同意本服务条款及相关规则。
              如你不同意，请停止使用本服务。
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">2. 服务说明</h2>
            <p>
              本服务为校园社交匹配工具，提供问卷填写、匹配参与、结果展示与相关互动功能。我们会持续优化功能，
              并可能在必要时调整、暂停或终止部分服务内容。
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">3. 账号与使用规范</h2>
            <p>
              你应确保注册信息真实、准确、完整，并妥善保管账号凭证。你不得利用本服务实施违法违规行为，
              包括但不限于骚扰他人、发布不当内容、破坏系统安全、恶意刷接口等。
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">4. 用户内容与授权</h2>
            <p>
              你提交的问卷、昵称、头像等内容仍归你所有。你同意在提供服务所必要的范围内，
              我们可对相关数据进行存储、处理与展示。
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">5. 免责声明</h2>
            <p>
              匹配结果由算法结合用户输入生成，仅作为参考，不构成任何承诺或保证。你应自行判断并承担
              因社交互动产生的风险与责任。
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">6. 违约与处理</h2>
            <p>
              如你违反法律法规或本条款，我们有权视情况采取限制功能、暂停服务、注销账号等措施，
              并保留追究相关责任的权利。
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-bold text-lg mb-2">7. 条款更新</h2>
            <p>
              我们可能根据业务变化更新本条款。更新后将在相关页面公布。你继续使用本服务即视为接受更新后的条款。
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-orange-100/30 flex items-center justify-between text-sm">
          <Link to="/register" className="text-secondary font-bold hover:opacity-80 transition-opacity">返回注册</Link>
          <Link to="/privacy" className="text-primary font-bold hover:underline underline-offset-4">查看隐私政策</Link>
        </div>
      </section>
    </main>
  );
};

export default TermsOfServicePage;
