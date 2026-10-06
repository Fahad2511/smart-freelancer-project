function dateAfterDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function nextInvoiceNumber(db, issueDate) {
  const year = issueDate.slice(0, 4);
  const prefix = `INV-${year}-`;
  const usedNumbers = db
    .prepare("SELECT invoice_number FROM invoices WHERE invoice_number LIKE ?")
    .all(`${prefix}%`);

  const maxSequence = usedNumbers.reduce((max, row) => {
    const match = row.invoice_number.match(new RegExp(`^INV-${year}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `${prefix}${String(maxSequence + 1).padStart(4, "0")}`;
}

function createInvoiceForProject(db, project, issueDate, dueDate) {
  const invoiceNumber = nextInvoiceNumber(db, issueDate);
  const result = db.prepare(`
    INSERT INTO invoices (project_id, invoice_number, amount, issue_date, due_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(project.id, invoiceNumber, project.budget, issueDate, dueDate);

  db.prepare(`
    INSERT INTO project_history (project_id, action, description)
    VALUES (?, ?, ?)
  `).run(
    project.id,
    "Invoice created",
    `Invoice ${invoiceNumber} created for ${project.budget}`,
  );

  return {
    invoice_id: result.lastInsertRowid,
    invoice_number: invoiceNumber,
    amount: project.budget,
    issue_date: issueDate,
    due_date: dueDate,
  };
}

module.exports = { dateAfterDays, nextInvoiceNumber, createInvoiceForProject };
