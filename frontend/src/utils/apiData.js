export function asList(data) {
  return data?.results || data || [];
}

export function pageState(data, page = 1, pageSize = 10) {
  const results = asList(data);
  const count = data?.count ?? results.length;
  return {
    rows: results,
    count,
    page,
    from: count === 0 ? 0 : (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, count),
    hasPreviousPage: Boolean(data?.previous),
    hasNextPage: Boolean(data?.next),
  };
}

export function tablePagination(pageData, setPage) {
  if (!pageData || pageData.count <= 10) return null;
  return {
    page: pageData.page,
    count: pageData.count,
    from: pageData.from,
    to: pageData.to,
    hasPreviousPage: pageData.hasPreviousPage,
    hasNextPage: pageData.hasNextPage,
    onPrevious: () => setPage((value) => Math.max(1, value - 1)),
    onNext: () => setPage((value) => value + 1),
  };
}
