const express = require("express");
const router = express.Router();

const db = require("../database/database");

router.get("/", (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT
        payments.*,
        invoices.invoice_number,
        projects.title AS project_title
      FROM payments
      JOIN invoices ON invoices.id = payments.invoice_id
      JOIN projects ON projects.id = invoices.project_id
      ORDER BY payments.id DESC
    `).all();

    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

router.post("/", (req, res) => {
  const { invoice_id, amount, payment_date, payment_method } = req.body;
  const hasValidInvoiceId = Number.isInteger(Number(invoice_id));
  const hasValidAmount = Number.isFinite(Number(amount)) && Number(amount) > 0;

  if (!hasValidInvoiceId || !hasValidAmount || !payment_date) {
    return res.status(400).json({
      error: "invoice_id, positive amount and payment_date are required",
    });
  }

  try {
    const invoice = db.prepare(`
      SELECT amount, project_id, invoice_number
      FROM invoices
      WHERE id = ?
    `).get(invoice_id);

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const paid = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total_paid
      FROM payments
      WHERE invoice_id = ?
    `).get(invoice_id);

    const remaining = invoice.amount - paid.total_paid;
    const paymentAmount = Number(amount);

    if (paymentAmount > remaining + 0.000001) {
      return res.status(400).json({
        error: `Payment exceeds remaining invoice balance of ${remaining}`,
      });
    }

    const recordPayment = db.transaction(() => {
      const payment = db.prepare(`
        INSERT INTO payments (invoice_id, amount, payment_date, payment_method)
        VALUES (?, ?, ?, ?)
      `).run(
        invoice_id,
        paymentAmount,
        payment_date,
        payment_method || null,
      );

      const result = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS total_paid
        FROM payments
        WHERE invoice_id = ?
      `).get(invoice_id);

      let status = "Pending";
      if (result.total_paid >= invoice.amount) {
        status = "Paid";
      } else if (result.total_paid > 0) {
        status = "Partially Paid";
      }

      db.prepare("UPDATE invoices SET status = ? WHERE id = ?")
        .run(status, invoice_id);

      db.prepare(`
        INSERT INTO project_history (project_id, action, description)
        VALUES (?, ?, ?)
      `).run(
        invoice.project_id,
        "Payment received",
        `Payment of ${paymentAmount} received for invoice ${invoice.invoice_number}`,
      );

      return {
        paymentId: payment.lastInsertRowid,
        totalPaid: result.total_paid,
        status,
      };
    });

    const recorded = recordPayment();

    res.status(201).json({
      message: "Payment recorded successfully",
      payment_id: recorded.paymentId,
      total_paid: recorded.totalPaid,
      invoice_status: recorded.status,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

module.exports = router;
