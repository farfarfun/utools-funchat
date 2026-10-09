import type { AgentAvatar } from '../../types.ts';

export type MarketAgent = {
  id: string;
  category: string;
  nickname: string;
  info: string;
  content: string;
  prompt: string;
  avatar?: AgentAvatar;
  autoPrefix?: string;
  quick_questions?: string[];
  temperature?: number;
  contextLength?: number;
};

// 角色按分类拆在 ./market/ 下，这里用 glob 自动收集——
// 新增一个分类文件即可生效，不必回来改这份清单。
// 刻意不用 eager：300 条提示词有 230 KB 源码，而 AI 市场只是个次级 tab，
// 让它们单独成块、进市场时再下载，首屏不必为此付钱。
const loaders = import.meta.glob<{ default: MarketAgent[] }>('./market/*.ts');

// tab 的展示顺序。没列到的分类会按文件名顺序排在后面，不会凭空消失。
const CATEGORY_ORDER = [
  '写作', '开发', '学习', '效率', '职场',
  '创意', '设计', '商业', '营销', '数据',
  '语言', '生活', '健康', '娱乐', '情感',
];

function categoryRank(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category);
  return index < 0 ? CATEGORY_ORDER.length : index;
}

let cached: MarketAgent[] | null = null;
let pending: Promise<MarketAgent[]> | null = null;

/**
 * 按需加载 AI 市场的全部角色，结果在本次运行内缓存。
 * @returns 按分类顺序排好的角色列表。
 */
export function loadMarketAgents(): Promise<MarketAgent[]> {
  if (cached) return Promise.resolve(cached);
  // 同时进入市场的多次调用共享同一个下载
  pending ||= Promise.all(Object.keys(loaders).sort().map((path) => loaders[path]()))
    .then((modules) => {
      cached = modules
        .flatMap((module) => module.default || [])
        .sort((left, right) => categoryRank(left.category) - categoryRank(right.category));
      return cached;
    })
    .catch((error) => {
      pending = null;
      throw error;
    });
  return pending;
}

/**
 * 从角色列表里取出分类 tab。
 * @param agents 已加载的角色列表。
 * @returns 以「全部」开头、按角色顺序去重的分类名。
 */
export function marketCategories(agents: MarketAgent[]): string[] {
  return ['全部', ...new Set(agents.map((agent) => agent.category))];
}
