const express = require("express");
const router = express.Router();
const db = require("../database/database");

router.get("/summary", (req, res) => {
  try {
    const totalEarnings = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM payments
    `).get();

    const activeProjects = db.prepare(`
      SELECT COUNT(*) AS total
      FROM projects
      WHERE status = 'active'
    `).get();

    const completedProjects = db.prepare(`
      SELECT COUNT(*) AS total
      FROM projects
      WHERE status = 'completed'
    `).get();

    const pendingPayments = db.prepare(`
      SELECT COALESCE(SUM(i.amount - COALESCE(p.total_paid, 0)), 0) AS total
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS total_paid
        FROM payments
        GROUP BY invoice_id
      ) p ON i.id = p.invoice_id
      WHERE i.status != 'Paid'
    `).get();

    const totalTasks = db.prepare(`
      SELECT COUNT(*) AS total
      FROM tasks
    `).get();

    const completedTasks = db.prepare(`
      SELECT COUNT(*) AS total
      FROM tasks
      WHERE status = 'Completed'
    `).get();

    res.json({
      total_earnings: totalEarnings.total,
      active_projects: activeProjects.total,
      completed_projects: completedProjects.total,
      pending_payments: pendingPayments.total,
      total_tasks: totalTasks.total,
      completed_tasks: completedTasks.total
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch dashboard summary"
    });
  }
});

module.exports = router;