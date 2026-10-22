import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const createDevMockApiPlugin = (enabled: boolean) => {
  return {
    name: 'dev-mock-api',
    apply: 'serve',
    configureServer(server: any) {
      if (!enabled) return;

      const mockUser = {
        id: 'user_001',
        email: 'student@hrbeu.edu.cn',
        nickname: '小明',
        avatar: '/avatar.jpg',
        gender: 'male',
        stage: 'undergrad_high',
        createdAt: '2024-01-15T10:00:00Z',
        verified: true,
      };

      const mockQuestionnaireModules = [
        {
          id: 'module_1',
          name: '基础画像',
          description: '基本信息填写',
          questions: [
            {
              id: 'q1',
              type: 'single',
              title: '你的性别是？',
              required: true,
              options: [
                { value: 'male', label: '男生', icon: 'man' },
                { value: 'female', label: '女生', icon: 'woman' },
              ],
            },
            {
              id: 'q2',
              type: 'single',
              title: '期待相遇的灵魂是？',
              required: true,
              options: [
                { value: 'male', label: '男生', icon: 'man' },
                { value: 'female', label: '女生', icon: 'woman' },
                { value: 'both', label: '都可以，灵魂契合最重要', icon: 'auto_awesome' },
              ],
            },
          ],
        },
        { id: 'module_2', name: '生活颗粒度', description: '日常生活习惯', questions: [] },
        { id: 'module_3', name: '性格调色盘', description: '性格特征分析', questions: [] },
        { id: 'module_4', name: '三观与旷野', description: '价值观与人生观', questions: [] },
        { id: 'module_5', name: '亲密关系说明书', description: '恋爱观与期望', questions: [] },
      ];

      const mockMatch = {
        id: 'match_001',
        matchId: 'match_2024_01',
        partner: {
          id: 'partner_001',
          nickname: 'Orange',
          avatar: '/avatar.jpg',
          matchRate: 98,
        },
        status: 'matched',
        createdAt: '2024-01-20T12:00:00Z',
        expiresAt: '2024-01-27T12:00:00Z',
        remainingTime: 72 * 3600,
      };

      const mockMessages: Array<any> = [];
      let unreadCount = 2;

      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const readJsonBody = async (req: any) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        if (!chunks.length) return null;
        const raw = Buffer.concat(chunks).toString('utf-8');
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      };

      const sendJson = (res: any, status: number, data: any) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(data));
      };

      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || '';
        const method = (req.method || 'GET').toUpperCase();

        if (!url.startsWith('/api/')) {
          return next();
        }

        // 模拟少量网络延迟，避免 UI 过快跳变
        await sleep(200);

        // ============ 认证相关 ============
        if (method === 'POST' && url === '/api/auth/login') {
          const body = (await readJsonBody(req)) as any;
          if (body?.email && body?.password) {
            return sendJson(res, 200, {
              code: 200,
              message: '登录成功',
              data: {
                token: `mock_token_${Date.now()}`,
                user: mockUser,
              },
            });
          }

          return sendJson(res, 400, { code: 400, message: '用户名或密码错误', data: null });
        }

        if (method === 'POST' && url === '/api/auth/register') {
          return sendJson(res, 200, {
            code: 200,
            message: '注册成功',
            data: {
              token: `mock_token_${Date.now()}`,
              user: mockUser,
            },
          });
        }

        if (method === 'POST' && url === '/api/auth/send-code') {
          return sendJson(res, 200, { code: 200, message: '验证码已发送', data: null });
        }

        // ============ 用户相关 ============
        if (method === 'GET' && url === '/api/user/me') {
          return sendJson(res, 200, { code: 200, message: '获取成功', data: mockUser });
        }

        if (method === 'GET' && url === '/api/user/profile') {
          return sendJson(res, 200, {
            code: 200,
            message: '获取成功',
            data: {
              userId: mockUser.id,
              gender: 'male',
              expectedGender: 'female',
              stage: 'undergrad_high',
              partnerStages: ['undergrad_high', 'master'],
              locations: ['图书馆', '11号楼', '食堂'],
              completedModules: 1,
              questionnaireProgress: 20,
            },
          });
        }

        // ============ 问卷相关 ============
        if (method === 'GET' && url === '/api/questionnaire/modules') {
          return sendJson(res, 200, { code: 200, message: '获取成功', data: mockQuestionnaireModules });
        }

        if (method === 'GET' && url.startsWith('/api/questionnaire/modules/')) {
          const id = decodeURIComponent(url.split('/').pop() || '');
          const module = mockQuestionnaireModules.find((m) => m.id === id) || mockQuestionnaireModules[0];
          return sendJson(res, 200, { code: 200, message: '获取成功', data: module });
        }

        if (method === 'GET' && url === '/api/questionnaire/progress') {
          return sendJson(res, 200, {
            code: 200,
            message: '获取成功',
            data: { completedModules: 1, totalModules: 5 },
          });
        }

        // ============ 匹配相关 ============
        if (method === 'GET' && url === '/api/match/current') {
          return sendJson(res, 200, {
            code: 200,
            message: '获取成功',
            data: {
              match: mockMatch,
              nextMatchTime: '2024-01-24T12:00:00Z',
            },
          });
        }

        if (method === 'POST' && url === '/api/match/join') {
          return sendJson(res, 200, { code: 200, message: '参与成功', data: null });
        }

        if (method === 'DELETE' && url === '/api/match/join') {
          return sendJson(res, 200, { code: 200, message: '取消成功', data: null });
        }

        if (method === 'GET' && url === '/api/match/next-time') {
          return sendJson(res, 200, {
            code: 200,
            message: '获取成功',
            data: { time: '2024-01-24T12:00:00Z', weekday: '周三', hour: 12 },
          });
        }

        // ============ 聊天相关 ============
        if (method === 'GET' && url.startsWith('/api/chat/messages/')) {
          return sendJson(res, 200, {
            code: 200,
            message: '获取成功',
            data: { list: mockMessages, total: 3, page: 1, pageSize: 20 },
          });
        }

        if (method === 'POST' && url === '/api/chat/send') {
          const body = (await readJsonBody(req)) as any;
          const message = {
            id: `msg_${Date.now()}`,
            senderId: mockUser.id,
            receiverId: 'partner_001',
            content: body?.content || '',
            createdAt: new Date().toISOString(),
            read: false,
          };
          mockMessages.push(message);
          unreadCount = Math.max(0, unreadCount);
          return sendJson(res, 200, { code: 200, message: '发送成功', data: message });
        }

        if (method === 'GET' && url === '/api/chat/unread-count') {
          return sendJson(res, 200, { code: 200, message: '获取成功', data: { count: unreadCount } });
        }

        if (method === 'POST' && url.startsWith('/api/chat/read/')) {
          unreadCount = 0;
          return sendJson(res, 200, { code: 200, message: '已读成功', data: null });
        }

        return sendJson(res, 404, { code: 404, message: 'Not Found', data: null });
      });
    },
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const shouldProxyApi = Boolean(env.VITE_API_BASE_URL)

  return {
    plugins: [react(), createDevMockApiPlugin(!shouldProxyApi)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      ...(shouldProxyApi
        ? {
            proxy: {
              '/api': {
                target: env.VITE_API_BASE_URL,
                changeOrigin: true,
              },
            },
          }
        : {}),
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined
            }

            if (id.includes('@supabase')) {
              return 'supabase-vendor'
            }

            return undefined
          },
        },
      },
    },
  }
})