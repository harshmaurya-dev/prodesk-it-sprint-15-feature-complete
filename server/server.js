import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Stripe from "stripe";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGINS = (process.env.CLIENT_URL || "http://localhost:5173").split(",").map(v => v.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || CLIENT_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error("This origin is not allowed by CORS."));
  }
}));
app.use(express.json({ limit: "1mb" }));

const User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }
}, { timestamps: true }));

const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  role: { type: String, required: true, trim: true, maxlength: 80 },
  department: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, trim: true, lowercase: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }
}, { timestamps: true }));

const createToken = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

function validateEmployee(body = {}) {
  const data = {};
  for (const field of ["name", "role", "department", "email"]) {
    const value = typeof body[field] === "string" ? body[field].trim() : "";
    if (!value) return { error: field + " is required." };
    data[field] = value;
  }
  if (data.name.length > 80 || data.role.length > 80 || data.department.length > 60) return { error: "One or more fields are too long." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { error: "Enter a valid employee email." };
  data.email = data.email.toLowerCase();
  return { data };
}

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return res.status(401).json({ message: "Authentication token required." });
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const account = await User.findById(payload.id).select("_id name email");
    if (!account) return res.status(401).json({ message: "Account not found. Please sign in again." });
    req.user = account;
    next();
  } catch {
    return res.status(401).json({ message: "Session expired or token is invalid. Please sign in again." });
  }
}

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "prodesk-sprint-15-api" }));

app.post("/api/auth/register", async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!name || name.length > 60) return res.status(400).json({ message: "Enter your name (maximum 60 characters)." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
  if (password.length < 8) return res.status(400).json({ message: "Password must contain at least 8 characters." });
  try {
    if (await User.findOne({ email })) return res.status(409).json({ message: "This email is already registered." });
    const account = await User.create({ name, email, password: await bcrypt.hash(password, 12) });
    return res.status(201).json({ token: createToken(account.id), user: { id: account.id, name: account.name, email: account.email } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This email is already registered." });
    throw error;
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const account = await User.findOne({ email });
  if (!account || !await bcrypt.compare(password, account.password)) return res.status(401).json({ message: "Invalid email or password." });
  res.json({ token: createToken(account.id), user: { id: account.id, name: account.name, email: account.email } });
});

app.get("/api/employees", authenticate, async (req, res) => {
  res.json(await Employee.find({ owner: req.user._id }).sort({ createdAt: -1 }));
});

app.post("/api/employees", authenticate, async (req, res) => {
  const result = validateEmployee(req.body);
  if (result.error) return res.status(400).json({ message: result.error });
  res.status(201).json(await Employee.create({ ...result.data, owner: req.user._id }));
});

app.put("/api/employees/:id", authenticate, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid employee ID." });
  const result = validateEmployee(req.body);
  if (result.error) return res.status(400).json({ message: result.error });
  const employee = await Employee.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    { $set: result.data },
    { new: true, runValidators: true }
  );
  if (!employee) return res.status(404).json({ message: "Employee not found in your workspace." });
  res.json(employee);
});

app.delete("/api/employees/:id", authenticate, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid employee ID." });
  const employee = await Employee.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!employee) return res.status(404).json({ message: "Employee not found in your workspace." });
  res.json({ id: employee.id, message: "Employee deleted." });
});

app.post("/api/checkout/create", authenticate, async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ message: "Stripe is not configured. Add a Stripe test secret key to the backend environment." });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price_data: { currency: "inr", product_data: { name: "Prodesk Workspace Upgrade" }, unit_amount: 9900 }, quantity: 1 }],
      success_url: CLIENT_ORIGINS[0] + "/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: CLIENT_ORIGINS[0] + "/dashboard"
    });
    res.json({ url: session.url });
  } catch {
    res.status(502).json({ message: "Unable to start Stripe checkout. Check the test key and try again." });
  }
});

app.use((req, res) => res.status(404).json({ message: "API route not found." }));
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).json({ message: "Something went wrong on the server." });
});

async function start() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing. Add it to the server environment.");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters.");
  await mongoose.connect(process.env.MONGO_URI);
  app.listen(PORT, () => console.log("Sprint 15 API running on port " + PORT));
}
start().catch(error => { console.error("Server startup failed:", error.message); process.exit(1); });
