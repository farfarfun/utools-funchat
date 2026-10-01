export const NOTIFICATIONS = [
  {
    id: 'notice-0-1-0',
    title: 'funchat 0.1.0 发布',
    date: '2026-08-26',
    unread: true,
    body: [
      '首个公开版本上线，感谢试用。',
      '本次带来：多 AI 好友切换、历史话题回溯、明暗主题、会话导出（Markdown / PNG / HTML / PDF）、Token 估算与全局搜索。',
      '如果用得顺手，欢迎到 GitHub 点个 Star；遇到问题也请直接提 Issue。',
    ],
  },
  {
    id: 'notice-stream-fix',
    title: '修复：流式回复不显示',
    date: '2026-08-25',
    unread: true,
    body: [
      '早期版本中，助手的回复会一直停留在空白气泡，直到切换好友才显示出来。',
      '原因是消息对象绕过了 Vue 的响应式代理，导致界面收不到更新通知。现已修复，并补上了回归测试。',
      '同一批修复还包括：历史记录被上下文窗口截断、停止生成后旧数据流仍在写入、SSE 心跳被当作正文插入回复。',
    ],
  },
  {
    id: 'notice-shortcuts',
    title: '快捷键已可用',
    date: '2026-08-25',
    unread: false,
    body: [
      '帮助中心里列出的快捷键此前只是文档，现在真正接上了：',
      'Ctrl + N 发起新话题 · Ctrl + B 切换侧边栏 · Ctrl + H 切换历史记录 · Shift + ↑/↓ 上下切换 AI 好友。',
      '弹窗打开时快捷键不会触发，不用担心误操作。',
    ],
  },
  {
    id: 'notice-poem-1',
    title: '今日一首 · 《登鹳雀楼》',
    date: '2026-08-24',
    unread: false,
    poem: { author: '［唐］王之涣', lines: ['白日依山尽，', '黄河入海流。', '欲穷千里目，', '更上一层楼。'] },
    body: ['写代码和登楼是一个道理：视野不够的时候，往往不是看得不够久，而是站得不够高。'],
  },
  {
    id: 'notice-poem-2',
    title: '今日一首 · 《题西林壁》',
    date: '2026-08-23',
    unread: false,
    poem: { author: '［宋］苏轼', lines: ['横看成岭侧成峰，', '远近高低各不同。', '不识庐山真面目，', '只缘身在此山中。'] },
    body: ['调了一下午没头绪的 bug，多半属于「只缘身在此山中」。起来走两步，或者讲给小黄鸭听听。'],
  },
  {
    id: 'notice-poem-3',
    title: '今日一首 · 《竹石》',
    date: '2026-08-22',
    unread: false,
    poem: { author: '［清］郑燮', lines: ['咬定青山不放松，', '立根原在破岩中。', '千磨万击还坚劲，', '任尔东西南北风。'] },
    body: ['送给还在重构祖传代码的你。'],
  },
];
