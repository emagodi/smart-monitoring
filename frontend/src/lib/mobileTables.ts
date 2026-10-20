/**
 * Gives every table cell a data-label (its column heading) so the phone stylesheet in index.css can lay
 * table rows out as cards. Runs on DOM changes, so tables that load, page or re-render stay labelled.
 */
function labelTables(root: ParentNode) {
  root.querySelectorAll("table").forEach((table) => {
    if (table.hasAttribute("data-keep-table")) return;
    const head = table.tHead?.rows[table.tHead.rows.length - 1];
    if (!head) return;
    const labels: string[] = [];
    for (const th of Array.from(head.cells)) {
      const text = (th.getAttribute("aria-label") || th.textContent || "").replace(/\s+/g, " ").replace(/[↑↓⇅]/g, "").trim();
      for (let i = 0; i < Math.max(1, th.colSpan); i++) labels.push(text);
    }
    for (const body of Array.from(table.tBodies)) {
      for (const row of Array.from(body.rows)) {
        let col = 0;
        const single = row.cells.length === 1;
        for (const cell of Array.from(row.cells)) {
          let label = single && cell.colSpan > 1 ? "" : labels[col] ?? "";
          // A heading-less or "Actions" column (not the first) holds row buttons: show them as a button row.
          const actions = col > 0 && !single && /^(actions?|)$/i.test(label);
          if (actions) label = "";
          if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
          if (actions !== cell.hasAttribute("data-actions")) cell.toggleAttribute("data-actions", actions);
          col += Math.max(1, cell.colSpan);
        }
      }
    }
  });
}

export function startMobileTables() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return () => {};
  let queued = false;
  const run = () => {
    queued = false;
    labelTables(document);
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  };
  const obs = new MutationObserver(schedule);
  obs.observe(document.body, { childList: true, subtree: true });
  schedule();
  return () => obs.disconnect();
}
