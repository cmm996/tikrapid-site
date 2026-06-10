export function dateOnly(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function displayDate(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function daysLeft(value: Date | string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = typeof value === "string" ? new Date(value) : new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "服务中",
    PAUSED: "暂停",
    EXPIRED: "已到期",
    CANCELLED: "已取消",
    OPEN: "待处理",
    IN_PROGRESS: "处理中",
    WAITING_CUSTOMER: "待客户补充",
    RESOLVED: "已解决",
    CLOSED: "已关闭",
  };
  return labels[status] || status;
}
