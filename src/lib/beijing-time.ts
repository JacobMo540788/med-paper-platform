import { BEIJING_TIMEZONE } from "./constants";

/** 获取当前北京时间对应的日历日期键 YYYY-MM-DD */
export function getBeijingDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BEIJING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** 格式化为首页展示的「今日」标签 */
export function formatBeijingTodayLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: BEIJING_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}
