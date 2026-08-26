export function clonePlain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
