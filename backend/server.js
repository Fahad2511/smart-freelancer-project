const express = require("express");
const cors = require("cors");
const clientRoutes = require("./routes/clientRoutes");
const ProjectRoutes = require("./routes/ProjectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
require("./database/schema");

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/clients", clientRoutes);
app.use("/api/projects", ProjectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "An unexpected server error occurred" });
});


app.get("/", (req, res) => {
  res.json({
    message: "Smart Freelancer API is running!",
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
