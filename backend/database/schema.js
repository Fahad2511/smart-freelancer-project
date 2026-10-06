const db = require("./database");

db.exec(`
   CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT null,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('freelancer','client','admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);


console.log("Users table created successfully!");


db.exec(`
    CREATE TABLE IF NOT EXISTS clients(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    company_name TEXT,
    phone TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
    );
    `);

console.log("Clients table created successfully!");

db.exec(`
    CREATE TABLE IF NOT EXISTS projects(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    budget REAL NOT NULL,
    deadline DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','completed','cancelled')),
    attachment_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(client_id)
    REFERENCES clients(id)
    ON DELETE CASCADE,
    
    UNIQUE(client_id,title)
    );
    `);

console.log("Projects table created successfully!");

db.exec(`
    CREATE TABLE IF NOT EXISTS tasks(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'To Do'
    CHECK(status IN('To Do','In Progress','Completed')),
    due_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(project_id)
    REFERENCES projects(id)
    ON DELETE CASCADE
    
    );
   `);

console.log("Tasks table created successfully!");

db.exec(`
    CREATE TABLE IF NOT EXISTS invoices(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE ,
    status TEXT NOT NULL DEFAULT 'Pending'
    CHECK(status IN('Pending','Partially Paid','Paid')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(project_id)
    REFERENCES projects(id)
    ON DELETE CASCADE
    );
    `);

console.log("Invoices table created successfully!");


db.exec(`
    CREATE TABLE IF NOT EXISTS payments(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_date DATE NOT NULL,
    payment_method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(invoice_id)
    REFERENCES invoices(id)
    ON DELETE CASCADE
    );
    `);

console.log("Payments table created successfully!");


db.exec(`
  CREATE TABLE IF NOT EXISTS project_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE CASCADE
  );
`);

console.log("Project history table created successfully!");


db.exec(`
  DROP TABLE IF EXISTS projects;

  CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    budget REAL NOT NULL,
    deadline DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK(status IN ('active', 'completed', 'cancelled')),
    attachment_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (client_id)
      REFERENCES clients(id)
      ON DELETE CASCADE,

    UNIQUE(client_id, title)
  );
`);

console.log("Projects table recreated successfully!");

db.prepare(`INSERT OR IGNORE INTO users
(id, name, email, password, role)
VALUES(?, ?, ?, ?, ?)
`).run(1,"Fahad","fahad25@gmail.com","fahadfhd","freelancer");

console.log("Test user created!");
