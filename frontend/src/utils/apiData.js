// Временный учебный комментарий: DRF иногда возвращает массив, а иногда объект
// пагинации с полем results. Этот helper приводит оба варианта к обычному массиву.
export function asList(data) {
  return data?.results || data || [];
}

