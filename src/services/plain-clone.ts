/**
 * 深拷贝可 JSON 序列化的数据，保留空值。
 * @param value 要复制的普通数据。
 * @returns 与输入值内容相同的新数据；空值原样返回。
 */
export function clonePlain<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
