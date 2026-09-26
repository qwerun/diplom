const FIELD_LABELS = {
  username: "Логин",
  password: "Пароль",
  first_name: "Имя",
  last_name: "Фамилия",
  email: "Email",
  profile: "Профиль",
  role: "Роль",
  name: "Название",
  url: "URL",
  unit: "Единица измерения",
  type: "Тип",
  is_active: "Активен",
  code: "Системный код",
  entity_type: "Сущность",
  start_date: "Дата начала",
  end_date: "Дата окончания",
  budget: "Бюджет",
  goal: "Цель",
  status: "Статус",
  responsible_user: "Ответственный менеджер",
  executor: "Исполнитель",
  channel: "Канал",
  metric_source: "Источник метрик",
  metric_type: "Тип метрики",
  file: "Файл",
  activity: "Активность",
  campaign: "Кампания",
  campaigns: "Кампании",
  non_field_errors: "Ошибка",
};

function normalizeMessage(value) {
  if (Array.isArray(value)) return value.map(normalizeMessage).filter(Boolean).join(" ");
  if (value && typeof value === "object") return formatErrorData(value, "");
  if (value === undefined || value === null) return "";
  return String(value);
}

function fieldLabel(field) {
  return FIELD_LABELS[field] || field;
}

export function formatErrorData(data, fallback) {
  if (typeof data === "string") {
    return data.includes("<!DOCTYPE") || data.includes("<html")
      ? fallback
      : data;
  }
  if (Array.isArray(data)) return normalizeMessage(data) || fallback;
  if (!data || typeof data !== "object") return fallback;
  if (typeof data.detail === "string") return data.detail;

  const messages = Object.entries(data)
    .map(([field, value]) => {
      const message = normalizeMessage(value);
      if (!message) return "";
      return field === "non_field_errors" ? message : `${fieldLabel(field)}: ${message}`;
    })
    .filter(Boolean);

  return messages.join(" ") || fallback;
}

export function formatApiError(error, fallback = "Произошла ошибка.") {
  if (error && typeof error === "object") {
    error.__handled = true;
  }
  return formatErrorData(error?.response?.data, fallback);
}
