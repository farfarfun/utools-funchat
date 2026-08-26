// 角色按分类拆在 ./market/ 下，这里用 glob 自动收集——
// 新增一个分类文件即可生效，不必回来改这份清单。
const modules = import.meta.glob('./market/*.js', { eager: true });

// tab 的展示顺序。没列到的分类会按文件名顺序排在后面，不会凭空消失。
const CATEGORY_ORDER = [
  '写作', '开发', '学习', '效率', '职场',
  '创意', '设计', '商业', '营销', '数据',
  '语言', '生活', '健康', '娱乐', '情感',
];

const collected = Object.keys(modules)
  .sort()
  .flatMap((path) => modules[path].default || []);

function categoryRank(category) {
  const index = CATEGORY_ORDER.indexOf(category);
  return index < 0 ? CATEGORY_ORDER.length : index;
}

export const MARKET_AGENTS = collected
  .slice()
  .sort((left, right) => categoryRank(left.category) - categoryRank(right.category));

export const MARKET_CATEGORIES = ['全部', ...new Set(MARKET_AGENTS.map((agent) => agent.category))];
