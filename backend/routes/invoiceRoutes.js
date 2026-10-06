const express = require("express");
const router = express.Router();

const db = require("../database/database");
const { nextInvoiceNumber } = require("../utils/invoiceHelpers");

router.get("/", (req, res) => {
  try {
    const invoices = db.prepare(`
      SELECT
        invoices.*,
        projects.title AS project_title,
        COALESCE(SUM(payments.amount), 0) AS total_paid
      FROM invoices
      JOIN projects ON projects.id = invoices.project_id
      LEFT JOIN payments ON payments.invoice_id = invoices.id
      GROUP BY invoices.id
      ORDER BY invoices.id DESC
    `).all();

    res.json(invoices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.post("/", (req, res) => {
  const { project_id, invoice_number, amount, issue_date, due_date } = req.body;

  const hasValidProjectId = Number.isInteger(Number(project_id));
  const hasValidAmount = Number.isFinite(Number(amount)) && Number(amount) > 0;

  if (!hasValidProjectId || !hasValidAmount || !issue_date || !due_date) {
    return res.status(400).json({
      error: "project_id, positive amount, issue_date and due_date are required",
    });
  }

  try {
    const project = db
      .prepare("SELECT id FROM projects WHERE id = ?")
      .get(project_id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const createInvoice = db.transaction(() => {
      const generatedNumber = nextInvoiceNumber(db, issue_date);
      const number = invoice_number?.trim() || generatedNumber;

      const result = db.prepare(`
        INSERT INTO invoices (
          project_id,
          invoice_number,
          amount,
          issue_date,
          due_date
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(project_id, number, Number(amount), issue_date, due_date);

      db.prepare(`
        INSERT INTO project_history (project_id, action, description)
        VALUES (?, ?, ?)
      `).run(project_id, "Invoice created", `Invoice ${number} created`);

      return {
        invoiceId: result.lastInsertRowid,
        invoiceNumber: number,
      };
    });

    const { invoiceId, invoiceNumber } = createInvoice();

    res.status(201).json({
      message: "Invoice created successfully",
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Invoice number already exists" });
    }

    console.error(error);
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

module.exports = router;
