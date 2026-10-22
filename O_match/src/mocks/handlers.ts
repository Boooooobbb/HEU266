import { http, HttpResponse, delay } from 'msw';

const LOCAL_CHAT_UNREAD_COUNT_KEY = 'stitch_o_match_chat_unread_count';

// 模拟用户数据
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

const mockMessages: Array<{
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  read: boolean;
}> = [];

const readUnreadCount = () => {
  const raw = localStorage.getItem(LOCAL_CHAT_UNREAD_COUNT_KEY);
  if (raw === null) {
    localStorage.setItem(LOCAL_CHAT_UNREAD_COUNT_KEY, '2');
    return 2;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const writeUnreadCount = (count: number) => {
  localStorage.setItem(LOCAL_CHAT_UNREAD_COUNT_KEY, String(Math.max(0, count)));
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
  {
    id: 'module_2',
    name: '生活颗粒度',
    description: '日常生活习惯',
    questions: [],
  },
  {
    id: 'module_3',
    name: '性格调色盘',
    description: '性格特征分析',
    questions: [],
  },
  {
    id: 'module_4',
    name: '三观与旷野',
    description: '价值观与人生观',
    questions: [],
  },
  {
    id: 'module_5',
    name: '亲密关系说明书',
    description: '恋爱观与期望',
    questions: [],
  },
];

export const handlers = [
  // ============ 认证相关 ============
  // POST /api/auth/login
  http.post('/api/auth/login', async ({ request }) => {
    await delay(500);
    const body = await request.json() as { email: string; password: string };

    if (body.email && body.password) {
      return HttpResponse.json({
        code: 200,
        message: '登录成功',
        data: {
          token: 'mock_token_' + Date.now(),
          user: mockUser,
        },
      });
    }

    return HttpResponse.json({
      code: 400,
      message: '用户名或密码错误',
      data: null,
    }, { status: 400 });
  }),

  // POST /api/auth/register
  http.post('/api/auth/register', async () => {
    await delay(500);
    return HttpResponse.json({
      code: 200,
      message: '注册成功',
      data: {
        token: 'mock_token_' + Date.now(),
        user: mockUser,
      },
    });
  }),

  // POST /api/auth/send-code
  http.post('/api/auth/send-code', async () => {
    await delay(300);
    return HttpResponse.json({
      code: 200,
      message: '验证码已发送',
      data: null,
    });
  }),

  // ============ 用户相关 ============
  // GET /api/user/me
  http.get('/api/user/me', async () => {
    await delay(300);
    return HttpResponse.json({
      code: 200,
      message: '获取成功',
      data: mockUser,
    });
  }),

  // GET /api/user/profile
  http.get('/api/user/profile', async () => {
    await delay(300);
    return HttpResponse.json({
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
  }),

  // ============ 问卷相关 ============
  // GET /api/questionnaire/modules
  http.get('/api/questionnaire/modules', async () => {
    await delay(300);
    return HttpResponse.json({
      code: 200,
      message: '获取成功',
      data: mockQuestionnaireModules,
    });
  }),

  // GET /api/questionnaire/modules/:id
  http.get('/api/questionnaire/modules/:id', async ({ params }) => {
    await delay(300);
    const module = mockQuestionnaireModules.find(m => m.id === params.id);
    return HttpResponse.json({
      code: 200,
      message: '获取成功',
      data: module || mockQuestionnaireModules[0],
    });
  }),

  // GET /api/questionnaire/progress
  http.get('/api/questionnaire/progress', async () => {
    await delay(300);
    return HttpResponse.json({
      code: 200,
      message: '获取成功',
      data: {
        completedModules: 1,
        totalModules: 5,
      },
    });
  }),

  // ============ 匹配相关 ============
  // GET /api/match/current
  http.get('/api/match/current', async () => {
    await delay(300);
    return HttpResponse.json({
      code: 200,
      message: '获取成功',
      data: {
        match: mockMatch,
        nextMatchTime: '2024-01-24T12:00:00Z',
      },
    });
  }),

  // POST /api/match/join
  http.post('/api/match/join', async () => {
    await delay(300);
    return HttpResponse.json({
      code: 200,
      message: '参与成功',
      data: null,
    });
  }),

  // DELETE /api/match/join
  http.delete('/api/match/join', async () => {
    await delay(300);
    return HttpResponse.json({
      code: 200,
      message: '取消成功',
      data: null,
    });
  }),

  // GET /api/match/next-time
  http.get('/api/match/next-time', async () => {
    await delay(300);
    return HttpResponse.json({
      code: 200,
      message: '获取成功',
      data: {
        time: '2024-01-24T12:00:00Z',
        weekday: '周三',
        hour: 12,
      },
    });
  }),

  // ============ 聊天相关 ============
  // GET /api/chat/messages/:matchId
  http.get('/api/chat/messages/:matchId', async () => {
    await delay(300);
    return HttpResponse.json({
      code: 200,
      message: '获取成功',
      data: {
        list: mockMessages,
        total: 3,
        page: 1,
        pageSize: 20,
      },
    });
  }),

  // POST /api/chat/send
  http.post('/api/chat/send', async ({ request }) => {
    await delay(200);
    const body = await request.json() as { matchId: string; content: string };
    return HttpResponse.json({
      code: 200,
      message: '发送成功',
      data: {
        id: 'msg_' + Date.now(),
        senderId: mockUser.id,
        receiverId: 'partner_001',
        content: body.content,
        createdAt: new Date().toISOString(),
        read: false,
      },
    });
  }),

  // GET /api/chat/unread-count
  http.get('/api/chat/unread-count', async () => {
    await delay(200);
    return HttpResponse.json({
      code: 200,
      message: '获取成功',
      data: {
        count: readUnreadCount(),
      },
    });
  }),

  // POST /api/chat/read/:matchId
  http.post('/api/chat/read/:matchId', async () => {
    writeUnreadCount(0);
    return HttpResponse.json({
      code: 200,
      message: '已读成功',
      data: null,
    });
  }),
];