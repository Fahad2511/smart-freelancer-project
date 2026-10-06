const express = require("express");
const router = express.Router();

const db = require("../database/database");

// The demo workspace uses the first freelancer record in the database.
router.get("/demo-user", (req, res) => {
  const user = db.prepare(`
    SELECT id, name, role
    FROM users
    WHERE role = 'freelancer'
    ORDER BY id
    LIMIT 1
  `).get();

  if (!user) {
    return res.status(404).json({
      error: "No demo freelancer user is configured",
    });
  }

  res.json(user);
});

router.post("/", (req, res) => {
  const { user_id, company_name, phone, address } = req.body;

  if (!Number.isInteger(Number(user_id)) || !company_name?.trim()) {
    return res.status(400).json({ error: "user_id and company_name are required" });
  }

  if (phone && !/^[+0-9() .-]{7,20}$/.test(phone)) {
    return res.status(400).json({ error: "Enter a valid phone number" });
  }

  try {
    const user = db
      .prepare("SELECT id FROM users WHERE id = ?")
      .get(user_id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = db.prepare(`
      INSERT INTO clients (user_id, company_name, phone, address)
      VALUES (?, ?, ?, ?)
    `).run(
      user_id,
      company_name.trim(),
      phone || null,
      address?.trim() || null,
    );

    res.status(201).json({
      message: "Client created successfully",
      client_id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create client" });
  }
});

router.get("/", (req, res) => {
  try {
    const clients = db.prepare(`
      SELECT *
      FROM clients
      ORDER BY id DESC
    `).all();

    res.json(clients);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

router.delete("/:id", (req, res) => {
  try {
    const deleteClient = db.transaction(() => {
      const result = db
        .prepare("DELETE FROM clients WHERE id = ?")
        .run(req.params.id);

      return result.changes;
    });

    if (deleteClient() === 0) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json({ message: "Client and related records deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

module.exports = router;
