import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";
const TASK_STATUSES = ["To Do", "In Progress", "Completed"];

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${date}T00:00:00`);
  return Math.round((dueDate - today) / 86400000);
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "The request could not be completed.");
  }

  return data;
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [summary, setSummary] = useState(null);
  const [clients, setClients] = useState([]);
  const [demoUser, setDemoUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Keep client management available if the backend is missing this newer route.
      const clientRows = await request("/clients");
      const user = await request("/clients/demo-user").catch(() => null);
      const existingOwner = clientRows.find((client) => client.user_id);

      setClients(clientRows);
      setDemoUser(
        user ||
          (existingOwner
            ? { id: existingOwner.user_id, role: "freelancer" }
            : null),
      );

      const results = await Promise.allSettled([
        request("/projects"),
        request("/tasks"),
        request("/invoices"),
        request("/payments"),
        request("/dashboard/summary"),
      ]);

      const [projectResult, taskResult, invoiceResult, paymentResult, summaryResult] =
        results;

      if (projectResult.status === "fulfilled") {
        setProjects(projectResult.value);
      }
      if (taskResult.status === "fulfilled") {
        setTasks(taskResult.value);
      }
      if (invoiceResult.status === "fulfilled") {
        setInvoices(invoiceResult.value);
      }
      if (paymentResult.status === "fulfilled") {
        setPayments(paymentResult.value);
      }
      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      }
    } catch (err) {
      setError(err.message || "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!selectedProject) return;

    request(`/projects/${selectedProject.id}/history`)
      .then(setHistory)
      .catch((err) => setError(err.message));
  }, [selectedProject, projects]);

  async function submit(event, path, body, successMessage) {
    event.preventDefault();
    setError("");
    setNotice("");

    const form = event.currentTarget;

    try {
      const result = await request(path, {
        method: "POST",
        body: JSON.stringify(body),
      });

      const message = result.invoice_number
        ? `Invoice ${result.invoice_number} created successfully.`
        : successMessage;

      setNotice(message);
      form.reset();
      await load();
    } catch (err) {
      setError(err.message);
      return false;
    }

    return true;
  }

  async function updateStatus(path, status, successMessage) {
    setError("");

    try {
      await request(path, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      setNotice(successMessage);
      await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  async function saveProject(projectId, values) {
    setError("");
    setNotice("");

    try {
      await request(`/projects/${projectId}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });

      setNotice("Project details saved.");

      const client = clients.find((item) => item.id === values.client_id);
      setSelectedProject((current) => ({
        ...current,
        ...values,
        company_name: client?.company_name || current.company_name,
      }));

      await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  async function generateProjectInvoice(projectId) {
    setError("");
    setNotice("");

    try {
      const result = await request(
        `/projects/${projectId}/generate-invoice`,
        { method: "POST" },
      );

      setNotice(
        `Invoice ${result.invoice_number} created for ${money(result.amount)}. ` +
          `Payment is due ${result.due_date}.`,
      );

      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteProject(projectId, projectTitle) {
    setError("");
    setNotice("");

    try {
      await request(`/projects/${projectId}`, { method: "DELETE" });
      setSelectedProject(null);
      setHistory([]);
      setNotice(`Project "${projectTitle}" was deleted.`);
      await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  const invoicesDueSoon = invoices
    .filter((invoice) => {
      if (invoice.status === "Paid" || !invoice.due_date) return false;

      const daysRemaining = daysUntil(invoice.due_date);
      return daysRemaining >= 0 && daysRemaining <= 14;
    })
    .sort((first, second) => first.due_date.localeCompare(second.due_date));

  const dueSoonBalance = invoicesDueSoon.reduce(
    (total, invoice) =>
      total + Math.max(0, invoice.amount - invoice.total_paid),
    0,
  );

  const navigation = [
    "dashboard",
    "clients",
    "projects",
    "tasks",
    "invoices",
    "payments",
  ];

  const pageTitles = {
    dashboard: "Dashboard",
    clients: "Clients",
    projects: "Projects",
    tasks: "Tasks",
    invoices: "Invoices",
    payments: "Payments",
  };

  return (
    <div className="app">
      <Sidebar
        navigation={navigation}
        page={page}
        pageTitles={pageTitles}
        onNavigate={(nextPage) => {
          setPage(nextPage);
          setSelectedProject(null);
          setHistory([]);
        }}
      />

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="eyebrow">
              SMART FREELANCER / {pageTitles[page].toUpperCase()}
            </div>
            <h1>
              {selectedProject && page === "projects"
                ? selectedProject.title
                : pageTitles[page]}
            </h1>
          </div>
          <button className="quiet-button" onClick={load}>
            ↻ Refresh
          </button>
        </header>

        {error && <div className="alert error" role="alert">{error}</div>}
        {notice && <div className="alert success" role="status">{notice}</div>}
        {loading && <p className="loading">Loading workspace…</p>}

        {page === "dashboard" && (
          <Dashboard
            summary={summary}
            projects={projects}
            invoicesDueSoon={invoicesDueSoon}
            dueSoonBalance={dueSoonBalance}
            onShowProjects={() => setPage("projects")}
            onShowInvoices={() => setPage("invoices")}
          />
        )}

        {page === "clients" && (
          <ClientsPage
            clients={clients}
            demoUser={demoUser}
            onSubmit={(event, body) =>
              submit(event, "/clients", body, "Client added successfully.")
            }
          />
        )}

        {page === "projects" && !selectedProject && (
          <ProjectsPage
            clients={clients}
            projects={projects}
            onSubmit={(event, body) =>
              submit(event, "/projects", body, "Project created successfully.")
            }
            onSelect={(project) => {
              setSelectedProject(project);
              setHistory([]);
            }}
          />
        )}

        {page === "projects" && selectedProject && (
          <ProjectDetails
            project={selectedProject}
            clients={clients}
            tasks={tasks.filter(
              (task) => task.project_id === selectedProject.id,
            )}
            invoices={invoices.filter(
              (invoice) => invoice.project_id === selectedProject.id,
            )}
            payments={payments}
            history={history}
            onBack={() => setSelectedProject(null)}
            onSave={saveProject}
            onGenerateInvoice={generateProjectInvoice}
            onDelete={deleteProject}
            onStatus={async (status) => {
              const saved = await updateStatus(
                `/projects/${selectedProject.id}/status`,
                status,
                "Project status updated.",
              );

              if (saved) {
                setSelectedProject((current) => ({ ...current, status }));
              }
            }}
          />
        )}

        {page === "tasks" && (
          <TasksPage
            projects={projects}
            tasks={tasks}
            onSubmit={(event, body) =>
              submit(event, "/tasks", body, "Task created successfully.")
            }
            onStatusChange={(taskId, status) =>
              updateStatus(
                `/tasks/${taskId}/status`,
                status,
                "Task status updated.",
              )
            }
          />
        )}

        {page === "invoices" && (
          <InvoicesPage
            projects={projects}
            invoices={invoices}
            onSubmit={(event, body) =>
              submit(event, "/invoices", body, "Invoice created successfully.")
            }
          />
        )}

        {page === "payments" && (
          <PaymentsPage
            invoices={invoices}
            payments={payments}
            onSubmit={(event, body) =>
              submit(event, "/payments", body, "Payment recorded successfully.")
            }
          />
        )}
      </main>
    </div>
  );
}

function Sidebar({ navigation, page, pageTitles, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand-mark">SF</div>
      <h2>Smart Freelancer</h2>
      <p className="side-caption">WORKSPACE</p>

      <nav>
        {navigation.map((item) => (
          <button
            className={page === item ? "active" : ""}
            key={item}
            onClick={() => onNavigate(item)}
          >
            {pageTitles[item]}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        Freelancer workspace
        <br />
        <small>Demo mode · no sign-in</small>
      </div>
    </aside>
  );
}

function Dashboard({
  summary,
  projects,
  invoicesDueSoon,
  dueSoonBalance,
  onShowProjects,
  onShowInvoices,
}) {
  const taskProgress = summary?.total_tasks
    ? Math.round((summary.completed_tasks / summary.total_tasks) * 100)
    : 0;

  const upcomingProjects = projects
    .filter((project) => project.status === "active")
    .sort((first, second) =>
      (first.deadline || "").localeCompare(second.deadline || ""),
    )
    .slice(0, 4);

  return (
    <>
      <p className="intro">Here’s a snapshot of your freelance business.</p>

      <section className="dashboard-grid">
        <Metric
          label="Total earnings"
          value={money(summary?.total_earnings)}
          icon="↗"
        />
        <Metric
          label="Active projects"
          value={summary?.active_projects ?? "—"}
          icon="◈"
        />
        <Metric
          label="Completed projects"
          value={summary?.completed_projects ?? "—"}
          icon="✓"
        />
        <Metric
          label="Pending payments"
          value={money(summary?.pending_payments)}
          icon="◷"
        />
        <Metric label="Total tasks" value={summary?.total_tasks ?? "—"} icon="▤" />
        <Metric
          label="Completed tasks"
          value={summary?.completed_tasks ?? "—"}
          icon="✓"
        />
        <Metric
          label="Payments due in 14 days"
          value={money(dueSoonBalance)}
          icon="◷"
        />
      </section>

      <section className="panel progress-panel">
        <div>
          <h2>Task progress</h2>
          <p>Completed tasks across all projects</p>
        </div>
        <strong>{taskProgress}%</strong>
        <div className="progress-track">
          <span style={{ width: `${taskProgress}%` }} />
        </div>
      </section>

      <section className="panel">
        <PanelHeading
          title="Invoices due soon"
          description="Unpaid balances due within the next 14 days"
          actionLabel="All invoices →"
          onAction={onShowInvoices}
        />
        {invoicesDueSoon.length ? (
          invoicesDueSoon.map((invoice) => (
            <div className="list-row" key={invoice.id}>
              <div>
                <b>
                  {invoice.invoice_number} · {invoice.project_title}
                </b>
                <span>
                  {money(Math.max(0, invoice.amount - invoice.total_paid))} remaining
                </span>
              </div>
              <span>Due {invoice.due_date}</span>
              <Badge value={invoice.status} />
            </div>
          ))
        ) : (
          <Empty>No unpaid invoices are due in the next 14 days.</Empty>
        )}
      </section>

      <section className="panel">
        <PanelHeading
          title="Upcoming deadlines"
          description="Your nearest active project deadlines"
          actionLabel="All projects →"
          onAction={onShowProjects}
        />
        {upcomingProjects.length ? (
          upcomingProjects.map((project) => (
            <div className="list-row" key={project.id}>
              <div>
                <b>{project.title}</b>
                <span>{project.company_name}</span>
              </div>
              <span>{project.deadline}</span>
              <Badge value={project.status} />
            </div>
          ))
        ) : (
          <Empty>No active project deadlines.</Empty>
        )}
      </section>
    </>
  );
}

function ClientsPage({ clients, demoUser, onSubmit }) {
  function handleSubmit(event) {
    const form = event.currentTarget;
    const body = {
      user_id: demoUser?.id,
      company_name: form.company_name.value.trim(),
      phone: form.phone.value.trim(),
      address: form.address.value.trim(),
    };

    onSubmit(event, body);
  }

  return (
    <div className="page-grid">
      <section className="panel form-panel">
        <h2>Add a client</h2>
        <p>Create a client company profile.</p>
        <form onSubmit={handleSubmit}>
          <Field label="Company name">
            <input
              name="company_name"
              placeholder="e.g. Acme Studio"
              required
            />
          </Field>
          <Field label="Phone">
            <input
              name="phone"
              type="tel"
              pattern="[+0-9() .-]{7,20}"
              title="Enter a valid phone number"
              required
            />
          </Field>
          <Field label="Address">
            <textarea name="address" rows="3" required />
          </Field>
          <button className="primary-button" disabled={!demoUser}>
            Add client
          </button>
        </form>
      </section>

      <section className="panel">
        <PanelHeading
          title="Your clients"
          description={`${clients.length} client profiles`}
        />
        {clients.length ? (
          clients.map((client) => (
            <div className="client-row" key={client.id}>
              <div className="avatar">
                {(client.company_name || "C").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <b>{client.company_name}</b>
                <span>{client.phone || "No phone"}</span>
                <span>{client.address || "No address"}</span>
              </div>
            </div>
          ))
        ) : (
          <Empty>No clients yet. Add your first client.</Empty>
        )}
      </section>
    </div>
  );
}

function ProjectsPage({ clients, projects, onSubmit, onSelect }) {
  function handleSubmit(event) {
    const form = event.currentTarget;
    const body = {
      client_id: Number(form.client_id.value),
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      budget: Number(form.budget.value),
      deadline: form.deadline.value,
      attachment_url: form.attachment_url.value.trim() || null,
    };

    onSubmit(event, body);
  }

  return (
    <div className="page-grid">
      <section className="panel form-panel">
        <h2>New project</h2>
        <p>
          Creating a project also creates a full-budget invoice due in 14 days.
        </p>
        <form onSubmit={handleSubmit}>
          <Field label="Client">
            <select name="client_id" defaultValue="" required>
              <option value="" disabled>
                Select a client
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Project title">
            <input name="title" required />
          </Field>
          <Field label="Description">
            <textarea name="description" rows="3" />
          </Field>
          <div className="two-fields">
            <Field label="Budget">
              <input
                name="budget"
                type="number"
                min="0.01"
                step="0.01"
                required
              />
            </Field>
            <Field label="Deadline">
              <input name="deadline" type="date" required />
            </Field>
          </div>
          <Field label="Attachment URL (optional)">
            <input
              name="attachment_url"
              type="url"
              placeholder="https://…"
            />
          </Field>
          <button className="primary-button">Create project</button>
        </form>
      </section>

      <section>
        <div className="panel-heading project-list-head">
          <div>
            <h2>Projects</h2>
            <p>{projects.length} projects</p>
          </div>
        </div>
        {projects.length ? (
          <div className="project-list">
            {projects.map((project) => (
              <button
                className="project-item"
                key={project.id}
                onClick={() => onSelect(project)}
              >
                <div className="project-item-top">
                  <span className="project-icon">◈</span>
                  <Badge value={project.status} />
                </div>
                <h3>{project.title}</h3>
                <p>{project.company_name}</p>
                <div className="project-meta">
                  <span>{money(project.budget)}</span>
                  <span>Due {project.deadline}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty>No projects yet. Create a project to get started.</Empty>
        )}
      </section>
    </div>
  );
}

function TasksPage({ projects, tasks, onSubmit, onStatusChange }) {
  function handleSubmit(event) {
    const form = event.currentTarget;
    const body = {
      project_id: Number(form.project_id.value),
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      due_date: form.due_date.value || null,
    };

    onSubmit(event, body);
  }

  return (
    <>
      <section className="panel form-panel inline-form">
        <div>
          <h2>Add a task</h2>
          <p>Choose a project and set a due date.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <Field label="Project">
            <select name="project_id" defaultValue="" required>
              <option value="" disabled>
                Select project
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Task title">
            <input name="title" required />
          </Field>
          <Field label="Description">
            <input name="description" />
          </Field>
          <Field label="Due date">
            <input name="due_date" type="date" />
          </Field>
          <button className="primary-button">Add task</button>
        </form>
      </section>

      <div className="kanban">
        {TASK_STATUSES.map((status) => {
          const columnTasks = tasks.filter((task) => task.status === status);

          return (
            <section className="kanban-column" key={status}>
              <div className="column-title">
                <h2>{status}</h2>
                <span>{columnTasks.length}</span>
              </div>

              {columnTasks.map((task) => (
                <article className="task-card" key={task.id}>
                  <h3>{task.title}</h3>
                  <p>{task.description || "No description"}</p>
                  <span className="task-project">◈ {task.project_title}</span>
                  <div className="task-card-bottom">
                    <span>
                      {task.due_date ? `Due ${task.due_date}` : "No due date"}
                    </span>
                    <select
                      aria-label={`Change status for ${task.title}`}
                      value={task.status}
                      onChange={(event) =>
                        onStatusChange(task.id, event.target.value)
                      }
                    >
                      {TASK_STATUSES.map((taskStatus) => (
                        <option key={taskStatus}>{taskStatus}</option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}

              {columnTasks.length === 0 && <Empty>No tasks here.</Empty>}
            </section>
          );
        })}
      </div>
    </>
  );
}

function InvoicesPage({ projects, invoices, onSubmit }) {
  function handleSubmit(event) {
    const form = event.currentTarget;
    const body = {
      project_id: Number(form.project_id.value),
      invoice_number: form.invoice_number.value.trim(),
      amount: Number(form.amount.value),
      issue_date: form.issue_date.value,
      due_date: form.due_date.value || null,
    };

    onSubmit(event, body);
  }

  return (
    <>
      <section className="panel form-panel inline-form">
        <div>
          <h2>Create invoice</h2>
          <p>Leave the invoice number blank to generate one automatically.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <Field label="Project">
            <select name="project_id" defaultValue="" required>
              <option value="" disabled>
                Select project
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Invoice number (optional)">
            <input name="invoice_number" placeholder="Generated automatically" />
          </Field>
          <Field label="Amount">
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </Field>
          <Field label="Issue date">
            <input name="issue_date" type="date" required />
          </Field>
          <Field label="Due date">
            <input name="due_date" type="date" required />
          </Field>
          <button className="primary-button">Create invoice</button>
        </form>
      </section>

      <section className="panel table-panel">
        <PanelHeading
          title="Invoices"
          description="Invoice status and outstanding balances"
        />
        {invoices.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Project</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Remaining</th>
                  <th>Issue date</th>
                  <th>Due date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td><b>{invoice.invoice_number}</b></td>
                    <td>{invoice.project_title}</td>
                    <td>{money(invoice.amount)}</td>
                    <td>{money(invoice.total_paid)}</td>
                    <td>
                      {money(Math.max(0, invoice.amount - invoice.total_paid))}
                    </td>
                    <td>{invoice.issue_date}</td>
                    <td>{invoice.due_date || "—"}</td>
                    <td><Badge value={invoice.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No invoices yet.</Empty>
        )}
      </section>
    </>
  );
}

function PaymentsPage({ invoices, payments, onSubmit }) {
  function handleSubmit(event) {
    const form = event.currentTarget;
    const body = {
      invoice_id: Number(form.invoice_id.value),
      amount: Number(form.amount.value),
      payment_date: form.payment_date.value,
      payment_method: form.payment_method.value,
    };

    onSubmit(event, body);
  }

  return (
    <>
      <section className="panel form-panel inline-form">
        <div>
          <h2>Record payment</h2>
          <p>Payments cannot exceed the invoice balance.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <Field label="Invoice">
            <select name="invoice_id" defaultValue="" required>
              <option value="" disabled>
                Select invoice
              </option>
              {invoices
                .filter((invoice) => invoice.amount > invoice.total_paid)
                .map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} · {invoice.project_title} ·{" "}
                    {money(invoice.amount - invoice.total_paid)} due
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Amount">
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </Field>
          <Field label="Payment date">
            <input name="payment_date" type="date" required />
          </Field>
          <Field label="Payment method">
            <select name="payment_method">
              <option>Bank Transfer</option>
              <option>UPI</option>
              <option>Cash</option>
              <option>Card</option>
              <option>Other</option>
            </select>
          </Field>
          <button className="primary-button">Record payment</button>
        </form>
      </section>

      <section className="panel table-panel">
        <PanelHeading
          title="Invoice balances"
          description="Paid and remaining amounts"
        />
        {invoices.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Project</th>
                  <th>Amount</th>
                  <th>Total paid</th>
                  <th>Remaining</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td><b>{invoice.invoice_number}</b></td>
                    <td>{invoice.project_title}</td>
                    <td>{money(invoice.amount)}</td>
                    <td>{money(invoice.total_paid)}</td>
                    <td>
                      {money(Math.max(0, invoice.amount - invoice.total_paid))}
                    </td>
                    <td><Badge value={invoice.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Create an invoice before recording a payment.</Empty>
        )}
      </section>

      <section className="panel table-panel">
        <PanelHeading
          title="Recent payments"
          description={`${payments.length} recorded payments`}
        />
        {payments.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Project</th>
                  <th>Method</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.payment_date}</td>
                    <td>{payment.invoice_number}</td>
                    <td>{payment.project_title}</td>
                    <td>{payment.payment_method || "—"}</td>
                    <td><b>{money(payment.amount)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No payments recorded.</Empty>
        )}
      </section>
    </>
  );
}

function ProjectDetails({
  project,
  clients,
  tasks,
  invoices,
  payments,
  history,
  onBack,
  onStatus,
  onSave,
  onGenerateInvoice,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const values = {
      client_id: Number(form.client_id.value),
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      budget: Number(form.budget.value),
      deadline: form.deadline.value,
      attachment_url: form.attachment_url.value.trim(),
    };

    const saved = await onSave(project.id, values);
    if (saved) setEditing(false);
  }

  async function confirmDelete() {
    setDeleting(true);
    const deleted = await onDelete(project.id, project.title);
    setDeleting(false);

    if (deleted) setDeleteDialogOpen(false);
  }

  return (
    <div className="details-wrap">
      <button className="text-button back-button" onClick={onBack}>
        ← Back to projects
      </button>

      <section className="details-hero panel">
        <div>
          <div className="eyebrow">PROJECT DETAILS</div>
          <h2>{project.title}</h2>
          <p>{project.company_name}</p>
        </div>
        <div className="project-actions">
          <button
            className="quiet-button"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? "Cancel edit" : "Edit details"}
          </button>
          <button
            className="delete-button"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete project
          </button>
          <label className="status-control">
            Project status
            <select
              value={project.status}
              onChange={(event) => onStatus(event.target.value)}
            >
              <option>active</option>
              <option>completed</option>
              <option>cancelled</option>
            </select>
          </label>
        </div>
      </section>

      {deleteDialogOpen && (
        <div
          className="delete-dialog-backdrop"
          onClick={() => !deleting && setDeleteDialogOpen(false)}
        >
          <section
            className="delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="delete-dialog-icon">!</span>
            <h2 id="delete-project-title">Delete “{project.title}”?</h2>
            <p>
              This permanently deletes the project, its tasks, invoices,
              payments, and activity history. This cannot be undone.
            </p>
            <div className="delete-dialog-actions">
              <button
                className="quiet-button"
                disabled={deleting}
                onClick={() => setDeleteDialogOpen(false)}
              >
                Keep project
              </button>
              <button
                className="danger-confirm-button"
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </section>
        </div>
      )}

      {editing && (
        <section className="panel form-panel">
          <h2>Edit project</h2>
          <p>Changes are saved to the project record.</p>
          <form className="edit-project-form" onSubmit={save}>
            <Field label="Client">
              <select name="client_id" defaultValue={project.client_id} required>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Project title">
              <input name="title" defaultValue={project.title} required />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                defaultValue={project.description || ""}
                rows="3"
              />
            </Field>
            <div className="two-fields">
              <Field label="Budget">
                <input
                  name="budget"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={project.budget}
                  required
                />
              </Field>
              <Field label="Deadline">
                <input
                  name="deadline"
                  type="date"
                  defaultValue={project.deadline}
                  required
                />
              </Field>
            </div>
            <Field label="Attachment URL">
              <input
                name="attachment_url"
                type="url"
                defaultValue={project.attachment_url || ""}
              />
            </Field>
            <button className="primary-button">Save project changes</button>
          </form>
        </section>
      )}

      <section className="details-grid">
        <DetailCard label="Budget" value={money(project.budget)} />
        <DetailCard label="Deadline" value={project.deadline} />
        <DetailCard
          label="Tasks"
          value={`${tasks.filter((task) => task.status === "Completed").length} / ${tasks.length} completed`}
        />
      </section>

      <section className="panel">
        <h2>About this project</h2>
        <p>{project.description || "No project description."}</p>
        {project.attachment_url && (
          <p className="attachment">
            Attachment:{" "}
            <a href={project.attachment_url} target="_blank" rel="noreferrer">
              Open project attachment ↗
            </a>
          </p>
        )}
      </section>

      <div className="page-grid detail-columns">
        <section className="panel">
          <h2>Tasks</h2>
          {tasks.length ? (
            tasks.map((task) => (
              <div className="list-row" key={task.id}>
                <b>{task.title}</b>
                <Badge value={task.status} />
              </div>
            ))
          ) : (
            <Empty>No project tasks.</Empty>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Invoices &amp; payments</h2>
              <p>Project invoice and payment status</p>
            </div>
            {invoices.length === 0 && (
              <button
                className="primary-button"
                onClick={() => onGenerateInvoice(project.id)}
              >
                Generate invoice
              </button>
            )}
          </div>

          {invoices.length ? (
            invoices.map((invoice) => (
              <div className="invoice-detail" key={invoice.id}>
                <div>
                  <b>{invoice.invoice_number}</b>
                  <span>
                    {money(invoice.total_paid)} paid of {money(invoice.amount)} ·
                    {" "}Due {invoice.due_date}
                  </span>
                </div>
                <Badge value={invoice.status} />
                <div className="payment-mini">
                  {payments
                    .filter((payment) => payment.invoice_id === invoice.id)
                    .map((payment) => (
                      <span key={payment.id}>
                        {payment.payment_date} · {money(payment.amount)}
                      </span>
                    ))}
                </div>
              </div>
            ))
          ) : (
            <Empty>Generate a full-budget invoice with payment due in 14 days.</Empty>
          )}
        </section>
      </div>

      <section className="panel">
        <PanelHeading
          title="Project history"
          description="Activity recorded for this project"
        />
        {history.length ? (
          history.map((item) => (
            <div className="history-row" key={item.id}>
              <span className="history-dot" />
              <div>
                <b>{item.description || item.action}</b>
                <span>
                  {item.action} ·{" "}
                  {new Date(`${item.created_at.replace(" ", "T")}Z`).toLocaleString()}
                </span>
              </div>
            </div>
          ))
        ) : (
          <Empty>No project activity recorded yet.</Empty>
        )}
      </section>
    </div>
  );
}

function PanelHeading({ title, description, actionLabel, onAction }) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel && (
        <button className="text-button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function Metric({ label, value, icon }) {
  return (
    <article className="metric-card">
      <span className="metric-icon">{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function DetailCard({ label, value }) {
  return (
    <article className="panel detail-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Empty({ children }) {
  return (
    <div className="empty-state">
      <span>◇</span>
      <p>{children}</p>
    </div>
  );
}

function Badge({ value }) {
  const className = String(value).toLowerCase().replaceAll(" ", "-");
  return <span className={`badge ${className}`}>{value}</span>;
}

export default App;
