import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import router from './config/router';
import './index.css';

// 清理 Supabase 认证错误 hash（如过期/无效的密码重置链接），
// 否则 Supabase 客户端处理时可能导致页面卡死
(function cleanupAuthErrorHash() {
  const hash = window.location.hash;
  if (hash.startsWith('#error=')) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
})();

// 启动 MSW mock 服务（仅在开发环境）
async function enableMocking() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser');
    return worker.start({
      onUnhandledRequest: 'bypass',
    });
  }
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
});