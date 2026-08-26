const TABLE_COLUMNS = new WeakMap();
const ALIGNMENTS = new Set(["left", "center", "right"]);
const SORT_TYPES = new Set(["text", "number", "bigint", "date"]);

function isNode(value) {
  return value && typeof value === "object" && typeof value.nodeType === "number";
}

function appendContent(parent, content) {
  if (content === undefined || content === null) return;
  parent.append(isNode(content) ? content : document.createTextNode(String(content)));
}

function normalizeColumn(column, index) {
  if (typeof column === "string") {
    return { label: column, key: `column-${index + 1}`, align: "left", sort: null, className: "" };
  }
  const source = column && typeof column === "object" ? column : {};
  const align = ALIGNMENTS.has(source.align) ? source.align : source.numeric ? "right" : "left";
  return {
    ...source,
    label: source.label ?? source.title ?? source.key ?? "",
    key: source.key ?? `column-${index + 1}`,
    align,
    sort: source.sort ?? null,
    className: source.className || ""
  };
}

function normalizedColumns(columns) {
  return Array.isArray(columns) ? columns.map(normalizeColumn) : [];
}

function alignmentClass(align) {
  return `table-align-${align}`;
}

function applyAlignment(node, column) {
  node.dataset.align = column.align;
  node.classList.add(alignmentClass(column.align));
  if (column.className) node.classList.add(...column.className.split(/\s+/).filter(Boolean));
}

/**
 * Creates the common native table structure without injecting markup strings.
 * Column definitions may be labels or { label, key, align, sort, className }.
 */
export function createTable(columns, captionText) {
  const definitions = normalizedColumns(columns);
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const table = document.createElement("table");
  TABLE_COLUMNS.set(table, definitions);

  if (captionText) table.createCaption().textContent = captionText;

  const columnGroup = document.createElement("colgroup");
  for (const column of definitions) {
    const columnElement = document.createElement("col");
    applyAlignment(columnElement, column);
    columnElement.dataset.column = column.key;
    if (column.width) columnElement.style.width = String(column.width);
    columnGroup.append(columnElement);
  }

  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const column of definitions) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.dataset.column = column.key;
    applyAlignment(cell, column);
    if (column.abbr) cell.abbr = column.abbr;
    appendContent(cell, column.label);
    headRow.append(cell);
  }
  head.append(headRow);

  const body = document.createElement("tbody");
  table.append(columnGroup, head, body);
  wrap.append(table);
  return { wrap, table, body };
}

/**
 * Creates one aligned cell. A descriptor can provide content, sortValue,
 * className, title, and ariaLabel without coupling page code to table markup.
 */
export function createTableCell(value, column, index = 0) {
  const definition = normalizeColumn(column, index);
  const descriptor = value && typeof value === "object" && !isNode(value) && "content" in value
    ? value
    : { content: value };
  const cell = document.createElement("td");
  applyAlignment(cell, definition);
  cell.dataset.column = definition.key;
  if (descriptor.className) cell.classList.add(...descriptor.className.split(/\s+/).filter(Boolean));
  if (descriptor.sortValue !== undefined) cell.dataset.sortValue = String(descriptor.sortValue);
  if (descriptor.title) cell.title = descriptor.title;
  if (descriptor.ariaLabel) cell.setAttribute("aria-label", descriptor.ariaLabel);
  appendContent(cell, descriptor.content);
  return cell;
}

/**
 * Appends an aligned row and returns it for page-specific metadata or controls.
 */
export function appendTableRow(body, columns, values, { className, dataset } = {}) {
  const definitions = normalizedColumns(columns);
  const row = document.createElement("tr");
  if (className) row.classList.add(...className.split(/\s+/).filter(Boolean));
  if (dataset) {
    for (const [key, value] of Object.entries(dataset)) {
      if (value !== undefined && value !== null) row.dataset[key] = String(value);
    }
  }
  for (const [index, column] of definitions.entries()) {
    const value = values?.[index];
    if (isNode(value) && value.nodeName === "TD") {
      applyAlignment(value, column);
      value.dataset.column = column.key;
      row.append(value);
    } else {
      row.append(createTableCell(value, column, index));
    }
  }
  body.append(row);
  return row;
}

function sortDefinition(column) {
  if (!column) return null;
  if (typeof column === "string") return SORT_TYPES.has(column) ? column : null;
  if (typeof column !== "object") return null;
  if (column.sort === true) return "text";
  if (typeof column.sort === "function") return column.sort;
  if (SORT_TYPES.has(column.sort)) return column.sort;
  if (column.sort && typeof column.sort === "object") return column.sort;
  return null;
}

function valueFor(cell, sort) {
  if (sort && typeof sort === "object" && typeof sort.value === "function") return sort.value(cell);
  return cell.dataset.sortValue ?? cell.textContent.trim();
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}

function compareValues(left, right, sort, leftRow, rightRow) {
  if (typeof sort === "function") return sort(left, right, leftRow, rightRow);
  const type = typeof sort === "object" ? sort.type || "text" : sort;
  if (type === "number") {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
    if (Number.isFinite(leftNumber)) return -1;
    if (Number.isFinite(rightNumber)) return 1;
    return compareText(left, right);
  }
  if (type === "bigint") {
    try {
      const leftBigInt = BigInt(left);
      const rightBigInt = BigInt(right);
      return leftBigInt < rightBigInt ? -1 : leftBigInt > rightBigInt ? 1 : 0;
    } catch {
      return compareText(left, right);
    }
  }
  if (type === "date") {
    const leftTime = Date.parse(left);
    const rightTime = Date.parse(right);
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime;
    if (Number.isFinite(leftTime)) return -1;
    if (Number.isFinite(rightTime)) return 1;
  }
  return compareText(left, right);
}

/**
 * Adds accessible sorting to selected headers.
 *
 * Legacy arrays such as ["number", "text", null, "bigint"] remain valid.
 * New column objects use a sort property with text/number/bigint/date, true,
 * a comparator, or { type, value(cell) }.
 */
export function makeSortable(table, body, columns = TABLE_COLUMNS.get(table) || []) {
  const headers = [...(table.tHead?.rows[0]?.cells || [])];
  const definitions = Array.isArray(columns) ? columns : [];
  const buttons = [];

  for (const [index, column] of definitions.entries()) {
    const sort = sortDefinition(column);
    const header = headers[index];
    if (!sort || !header) continue;

    if (column && typeof column === "object" && column.align) {
      const normalized = normalizeColumn(column, index);
      applyAlignment(header, normalized);
      for (const row of body.rows) applyAlignment(row.cells[index], normalized);
    }

    const label = header.dataset.sortLabel || header.textContent.trim();
    header.dataset.sortLabel = label;
    const button = document.createElement("button");
    button.className = "sort-button";
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => {
      const direction = header.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
      for (const item of headers) item.removeAttribute("aria-sort");
      header.setAttribute("aria-sort", direction);
      const multiplier = direction === "ascending" ? 1 : -1;
      const rows = [...body.rows];
      rows.sort((leftRow, rightRow) => {
        const left = valueFor(leftRow.cells[index], sort);
        const right = valueFor(rightRow.cells[index], sort);
        return compareValues(left, right, sort, leftRow, rightRow) * multiplier;
      });
      body.append(...rows);
    });
    header.replaceChildren(button);
    buttons.push(button);
  }

  return buttons;
}
