export function getStatusOptions(currentName, statuses, transitions) {
  const allowedIds = transitions
    .filter((transition) => transition.from_status_name === currentName)
    .map((transition) => transition.to_status);

  return statuses.filter((status) => allowedIds.includes(status.id));
}
