export function getStatusOptions(currentName, statuses, transitions) {
  // Временный учебный комментарий: backend хранит переходы как id статусов,
  // а экрану удобнее получить готовый список статусов для select.
  const allowedIds = transitions
    .filter((transition) => transition.from_status_name === currentName)
    .map((transition) => transition.to_status);

  return statuses.filter((status) => allowedIds.includes(status.id));
}
