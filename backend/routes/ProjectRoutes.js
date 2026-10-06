const express = require("express");
const router = express.Router();

const db = require("../database/database");
const {
  dateAfterDays,
  createInvoiceForProject,
} = require("../utils/invoiceHelpers");

function hasValidProjectDetails({ client_id, title, budget, deadline }) {
  return (
    Number.isInteger(Number(client_id)) &&
    Boolean(title?.trim()) &&
    Number.isFinite(Number(budget)) &&
    Number(budget) > 0 &&
    Boolean(deadline)
  );
}

router.post("/", (req, res) => {
  const { client_id, title, description, budget, deadline, attachment_url } =
    req.body;

  if (!hasValidProjectDetails(req.body)) {
    return res.status(400).json({
      error: "client_id, title, positive budget and deadline are required",
    });
  }

  try {
    const client = db
      .prepare("SELECT id FROM clients WHERE id = ?")
      .get(client_id);

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const createProject = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO projects (
          client_id,
          title,
          description,
          budget,
          deadline,
          attachment_url
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        Number(client_id),
        title.trim(),
        description?.trim() || null,
        Number(budget),
        deadline,
        attachment_url?.trim() || null,
      );

      db.prepare(`
        INSERT INTO project_history (project_id, action, description)
        VALUES (?, ?, ?)
      `).run(
        result.lastInsertRowid,
        "Project created",
        `Project "${title.trim()}" created`,
      );

      const issueDate = new Date().toISOString().slice(0, 10);
      const project = {
        id: result.lastInsertRowid,
        budget: Number(budget),
      };
      const invoice = createInvoiceForProject(
        db,
        project,
        issueDate,
        dateAfterDays(issueDate, 14),
      );

      return { projectId: result.lastInsertRowid, invoice };
    });

    const { projectId, invoice } = createProject();

    res.status(201).json({
      message: "Project created successfully",
      project_id: projectId,
      invoice,
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        error: "A project with this title already exists for this client",
      });
    }

    console.error(error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.post("/:id/generate-invoice", (req, res) => {
  try {
    const project = db.prepare(`
      SELECT id, budget
      FROM projects
      WHERE id = ?
    `).get(req.params.id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const existingInvoice = db.prepare(`
      SELECT id
      FROM invoices
      WHERE project_id = ?
      LIMIT 1
    `).get(project.id);

    if (existingInvoice) {
      return res.status(409).json({
        error: "This project already has an invoice",
      });
    }

    const issueDate = new Date().toISOString().slice(0, 10);
    const generateInvoice = db.transaction(() =>
      createInvoiceForProject(
        db,
        project,
        issueDate,
        dateAfterDays(issueDate, 14),
      ),
    );

    const invoice = generateInvoice();
    res.status(201).json({ message: "Project invoice generated", ...invoice });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate project invoice" });
  }
});

router.delete("/:id", (req, res) => {
  try {
    const deleteProject = db.transaction(() => {
      const result = db
        .prepare("DELETE FROM projects WHERE id = ?")
        .run(req.params.id);

      return result.changes;
    });

    const deletedCount = deleteProject();

    if (deletedCount === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

router.get("/", (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT projects.*, clients.company_name
      FROM projects
      JOIN clients ON projects.client_id = clients.id
      ORDER BY projects.id DESC
    `).all();

    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.put("/:id", (req, res) => {
  const { client_id, title, description, budget, deadline, attachment_url } =
    req.body;

  if (!hasValidProjectDetails(req.body)) {
    return res.status(400).json({
      error: "client_id, title, positive budget and deadline are required",
    });
  }

  try {
    const project = db
      .prepare("SELECT id FROM projects WHERE id = ?")
      .get(req.params.id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const client = db
      .prepare("SELECT id FROM clients WHERE id = ?")
      .get(client_id);

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const updateProject = db.transaction(() => {
      db.prepare(`
        UPDATE projects
        SET
          client_id = ?,
          title = ?,
          description = ?,
          budget = ?,
          deadline = ?,
          attachment_url = ?
        WHERE id = ?
      `).run(
        Number(client_id),
        title.trim(),
        description?.trim() || null,
        Number(budget),
        deadline,
        attachment_url?.trim() || null,
        req.params.id,
      );

      db.prepare(`
        INSERT INTO project_history (project_id, action, description)
        VALUES (?, ?, ?)
      `).run(
        req.params.id,
        "Project updated",
        `Project details updated for "${title.trim()}"`,
      );
    });

    updateProject();
    res.json({ message: "Project updated successfully" });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        error: "A project with this title already exists for this client",
      });
    }

    console.error(error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.put("/:id/status", (req, res) => {
  const allowedStatuses = ["active", "completed", "cancelled"];

  if (!allowedStatuses.includes(req.body.status)) {
    return res.status(400).json({
      error: "Status must be active, completed or cancelled",
    });
  }

  try {
    const project = db
      .prepare("SELECT title FROM projects WHERE id = ?")
      .get(req.params.id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const updateStatus = db.transaction(() => {
      db.prepare("UPDATE projects SET status = ? WHERE id = ?")
        .run(req.body.status, req.params.id);

      db.prepare(`
        INSERT INTO project_history (project_id, action, description)
        VALUES (?, ?, ?)
      `).run(
        req.params.id,
        "Project status changed",
        `Project status changed to ${req.body.status}`,
      );
    });

    updateStatus();
    res.json({ message: "Project status updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update project status" });
  }
});

router.get("/:id/history", (req, res) => {
  const project = db
    .prepare("SELECT id FROM projects WHERE id = ?")
    .get(req.params.id);

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  try {
    const history = db.prepare(`
      SELECT *
      FROM project_history
      WHERE project_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(req.params.id);

    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch project history" });
  }
});

module.exports = router;
