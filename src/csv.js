export const CSV_HEADER = [
  "id",
  "childId",
  "childName",
  "offeredMl",
  "consumedMl",
  "spitUp",
  "fedAt",
];
export function csvCell(value) {
  let s = String(value);
  // Spreadsheet formula injection protection; parser removes our escape on names only.
  if (/^[=+@\-\t\r']/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function exportCsv(records, children) {
  return (
    "\uFEFF" +
    [
      CSV_HEADER.join(","),
      ...records.map((r) =>
        [
          r._id,
          r.childId,
          children.find((c) => c.id === r.childId)?.name || "",
          r.offeredMl,
          r.consumedMl,
          r.spitUp,
          r.fedAt,
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n")
  );
}
export function parseCsv(text) {
  if (text.length > 1024 * 1024)
    throw new Error("Файл завеликий. Максимум 1 МБ.");
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  function endCell() {
    row.push(cell);
    cell = "";
    closed = false;
  }
  function endRow() {
    endCell();
    if (row.some((v) => v !== "")) rows.push(row);
    row = [];
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw new Error("Некоректні лапки CSV.");
      quoted = true;
    } else if (c === ",") endCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      if (closed) throw new Error("Некоректний CSV після лапок.");
      cell += c;
    }
  }
  if (quoted) throw new Error("Незакриті лапки CSV.");
  if (cell || row.length || closed) endRow();
  if (rows.shift()?.join(",") !== CSV_HEADER.join(","))
    throw new Error("Потрібен CSV стандарту am-am: " + CSV_HEADER.join(", "));
  if (!rows.length || rows.length > 500)
    throw new Error("За один імпорт — від 1 до 500 записів.");
  const seen = new Set();
  return rows.map((r, i) => {
    if (
      r.length !== 7 ||
      !r[0] ||
      r[0].length > 100 ||
      !r[1] ||
      r[1].length > 100 ||
      !/^\d+$/.test(r[3]) ||
      !/^\d+$/.test(r[4]) ||
      !["true", "false"].includes(r[5]) ||
      !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(r[6]) ||
      !Number.isFinite(Date.parse(r[6]))
    )
      throw new Error(`Перевірте рядок ${i + 2}.`);
    if (seen.has(r[0])) throw new Error(`Повторний ID у рядку ${i + 2}.`);
    seen.add(r[0]);
    const offeredMl = Number(r[3]),
      consumedMl = Number(r[4]);
    if (
      offeredMl < 30 ||
      offeredMl > 300 ||
      offeredMl % 30 ||
      consumedMl < 0 ||
      consumedMl > offeredMl
    )
      throw new Error(`Некоректний об’єм у рядку ${i + 2}.`);
    return {
      sourceId: r[0],
      sourceChildId: r[1],
      childName: r[2].replace(/^'(?=[=+@\-\t\r'])/, ""),
      offeredMl,
      consumedMl,
      spitUp: r[5] === "true",
      fedAt: new Date(r[6]).toISOString(),
    };
  });
}
