// Временный учебный комментарий: все коды ролей собраны здесь, чтобы не
// дублировать строки "admin", "manager" и т.д. в каждой странице.
export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  EXECUTOR: "executor",
  HEAD: "head",
};

export const ROLE_LABELS = [
  [ROLES.ADMIN, "Администратор"],
  [ROLES.MANAGER, "Менеджер"],
  [ROLES.EXECUTOR, "Исполнитель"],
  [ROLES.HEAD, "Руководитель"],
];

export const CAN_MANAGE_CAMPAIGNS = [ROLES.ADMIN, ROLES.MANAGER];
export const CAN_CHANGE_STATUS = [ROLES.ADMIN, ROLES.MANAGER, ROLES.EXECUTOR];
export const CAN_EDIT_EXECUTION = [ROLES.ADMIN, ROLES.MANAGER, ROLES.EXECUTOR];
export const CAN_VIEW_REPORTS = [ROLES.ADMIN, ROLES.HEAD];

