import { useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

function valueForSort(row, column) {
  if (column.sortValue) return column.sortValue(row);
  const value = row[column.key];
  if (Array.isArray(value)) return value.join(", ");
  return value ?? "";
}

function compareValues(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (left !== "" && right !== "" && !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return String(left).localeCompare(String(right), "ru-RU", { numeric: true, sensitivity: "base" });
}

function nextDirection(currentKey, currentDirection, key) {
  if (currentKey !== key) return "asc";
  return currentDirection === "asc" ? "desc" : "asc";
}

export default function DataTable({
  columns,
  rows,
  emptyText = "Нет данных",
  pageSize = DEFAULT_PAGE_SIZE,
  pagination = true,
  sortKey: externalSortKey,
  sortDirection: externalSortDirection,
  onSort,
  manualSort = false,
  manualPagination,
}) {
  const [internalSortKey, setInternalSortKey] = useState("");
  const [internalSortDirection, setInternalSortDirection] = useState("asc");
  const [internalPage, setInternalPage] = useState(1);

  const sortKey = externalSortKey ?? internalSortKey;
  const sortDirection = externalSortDirection ?? internalSortDirection;

  const sortableColumns = columns.filter((column) => !column.disableSort && column.key !== "actions");

  function changeSort(column) {
    if (column.disableSort || column.key === "actions") return;
    const direction = nextDirection(sortKey, sortDirection, column.key);
    if (onSort) {
      onSort(column, direction);
    } else {
      setInternalSortKey(column.key);
      setInternalSortDirection(direction);
      setInternalPage(1);
    }
  }

  const sortedRows = useMemo(() => {
    if (manualSort || !sortKey) return rows;
    const column = sortableColumns.find((item) => item.key === sortKey);
    if (!column) return rows;
    const direction = sortDirection === "desc" ? -1 : 1;
    return [...rows].sort((left, right) => compareValues(valueForSort(left, column), valueForSort(right, column)) * direction);
  }, [manualSort, rows, sortKey, sortDirection, sortableColumns]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(internalPage, pageCount);
  const visibleRows = useMemo(() => {
    if (!pagination || manualPagination) return sortedRows;
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [currentPage, manualPagination, pageSize, pagination, sortedRows]);

  const pager = manualPagination || (pagination && sortedRows.length > pageSize ? {
    page: currentPage,
    count: sortedRows.length,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < pageCount,
    onPrevious: () => setInternalPage((value) => Math.max(1, value - 1)),
    onNext: () => setInternalPage((value) => Math.min(pageCount, value + 1)),
  } : null);

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => {
                const sortable = !column.disableSort && column.key !== "actions";
                const active = sortKey === column.key;
                return (
                  <th key={column.key}>
                    {sortable ? (
                      <button type="button" className="table-sort-button" onClick={() => changeSort(column)}>
                        <span>{column.title}</span>
                        <span className={`sort-arrow${active ? " active" : ""}`}>{active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
                      </button>
                    ) : column.title}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="empty-cell">{emptyText}</td>
              </tr>
            )}
            {visibleRows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pager && (
        <div className="pagination-bar">
          <button className="plain-button small" disabled={!pager.hasPreviousPage} onClick={pager.onPrevious}>Назад</button>
          <span>Страница {pager.page}</span>
          <button className="plain-button small" disabled={!pager.hasNextPage} onClick={pager.onNext}>Вперед</button>
        </div>
      )}
    </>
  );
}
