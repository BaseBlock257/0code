require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------
// SUPABASE SETUP
// -----------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

// -----------------------------
// AUTH ROUTES (REGISTER)
// -----------------------------
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email & password required" });

  // Check if user exists
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (existing) return res.status(400).json({ error: "User already exists" });

  const hash = await bcrypt.hash(password, 10);

  // Insert user
  const { data, error } = await supabase.from("users").insert([
    { email, name, password: hash }
  ]);

  if (error) return res.status(400).json({ error });

  // Create token
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "7d" });

  res.json({ user: data[0], token });
});

// -----------------------------
// LOGIN
// -----------------------------
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (!user) return res.status(400).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Invalid credentials" });

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ user, token });
});

// -----------------------------
// SIMPLE PROTECTED ROUTE
// -----------------------------
function auth(req, res, next) {
  const bearer = req.headers.authorization;
  if (!bearer) return res.status(401).json({ error: "No token" });

  try {
    const token = bearer.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/api/secure", auth, async (req, res) => {
  res.json({ message: "Protected data visible", user: req.user });
});

// -----------------------------
const PORT = 3001;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
