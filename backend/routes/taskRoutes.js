const express = require("express");
const router = express.Router();

const db = require("../database/database");

router.get("/", (req, res) => {
  try {
    const tasks = db.prepare(`
      SELECT tasks.*, projects.title AS project_title
      FROM tasks
      JOIN projects ON projects.id = tasks.project_id
      ORDER BY tasks.id DESC
    `).all();

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.post("/", (req, res) => {
  const { project_id, title, description, due_date } = req.body;

  if (!Number.isInteger(Number(project_id)) || !title?.trim()) {
    return res.status(400).json({
      error: "project_id and title are required",
    });
  }

  try {
    const project = db
      .prepare("SELECT title FROM projects WHERE id = ?")
      .get(project_id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const createTask = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO tasks (project_id, title, description, due_date)
        VALUES (?, ?, ?, ?)
      `).run(
        project_id,
        title.trim(),
        description?.trim() || null,
        due_date || null,
      );

      db.prepare(`
        INSERT INTO project_history (project_id, action, description)
        VALUES (?, ?, ?)
      `).run(project_id, "Task created", `Task "${title.trim()}" added`);

      return result;
    });

    const result = createTask();

    res.status(201).json({
      message: "Task created successfully",
      task_id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.put("/:id/status", (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  const allowedStatuses = ["To Do", "In Progress", "Completed"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const task = db.prepare(`
      SELECT project_id, title, status
      FROM tasks
      WHERE id = ?
    `).get(id);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const updateTask = db.transaction(() => {
      db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, id);

      if (task.status !== status) {
        db.prepare(`
          INSERT INTO project_history (project_id, action, description)
          VALUES (?, ?, ?)
        `).run(
          task.project_id,
          "Task status changed",
          `Task "${task.title}" status changed to ${status}`,
        );
      }
    });

    updateTask();
    res.json({ message: "Task status updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update task status" });
  }
});

module.exports = router;
