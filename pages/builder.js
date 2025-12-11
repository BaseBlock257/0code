// pages/builder.js
import { useEffect, useRef, useState } from "react";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";

export default function Builder() {
  const editorRef = useRef(null);
  const [models, setModels] = useState([]);
  const [modelName, setModelName] = useState("");
  const [fields, setFields] = useState("");

  // Initialize GrapesJS once
  useEffect(() => {
    if (editorRef.current) return;

    const editor = grapesjs.init({
      container: "#gjs",
      height: "100vh",
      fromElement: false,
      storageManager: false,
      blockManager: { appendTo: "#blocks" },
    });

    editorRef.current = editor;
    const bm = editor.BlockManager;

    // Preserve your previous basic blocks + extras
    bm.add("section", {
      label: "Section",
      content: "<section><h2>Title</h2><p>Some text here...</p></section>",
      category: "Basic",
    });
    bm.add("text", { label: "Text", content: "<p>Editable text</p>", category: "Basic" });
    bm.add("btn", { label: "Button", content: "<button class='btn'>Click me</button>", category: "Basic" });
    bm.add("image", { label: "Image", content: "<img src='https://placekitten.com/200/200'/>", category: "Basic" });

    bm.add("two-columns", {
      label: "Two Columns",
      content: `<div style="display:flex; gap:10px;">
        <div style="flex:1; background:#eee; padding:10px;">Column 1</div>
        <div style="flex:1; background:#ddd; padding:10px;">Column 2</div>
      </div>`,
      category: "Layout",
    });
    bm.add("three-columns", {
      label: "Three Columns",
      content: `<div style="display:flex; gap:10px;">
        <div style="flex:1; background:#eee; padding:10px;">Col 1</div>
        <div style="flex:1; background:#ddd; padding:10px;">Col 2</div>
        <div style="flex:1; background:#ccc; padding:10px;">Col 3</div>
      </div>`,
      category: "Layout",
    });

    bm.add("video", {
      label: "Video",
      content: `<video controls style="width:100%;"><source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" /></video>`,
      category: "Media",
    });
    bm.add("iframe", {
      label: "Embed iFrame",
      content: `<iframe src="https://www.example.com" style="width:100%; height:300px;" frameborder="0"></iframe>`,
      category: "Media",
    });

    bm.add("form", {
      label: "Form (auto-post)",
      content: `<form data-auto="true" data-api="/api/users" style="padding:10px;">
        <input name="name" placeholder="Name" /><br/>
        <input name="email" placeholder="Email" /><br/>
        <button type="submit">Submit</button>
      </form>`,
      category: "Forms",
    });

    bm.add("card", {
      label: "Card",
      content: `<div style="padding:12px;border:1px solid #ddd;border-radius:8px;">
        <h3>Product Title</h3>
        <p>Short description</p>
        <button class="btn" data-api="/api/products" data-method="POST">Buy</button>
      </div>`,
      category: "Components",
    });

    bm.add("api-button", {
      label: "API Button",
      content: `<button class="btn" data-api="/api/users" data-method="POST" data-body='{"sample":true}'>Call API</button>`,
      category: "Actions",
    });
    bm.add("nav-button", {
      label: "Navigate Button",
      content: `<button class="btn" data-nav="/thank-you">Go to thank you</button>`,
      category: "Actions",
    });

    // Safety: ensure #blocks area doesn't get hidden by grapesjs styles
    const styleEl = document.createElement("style");
    styleEl.innerHTML = `
      /* keep our left sidebar above grapesjs panels, make headings visible */
      #left-sidebar { z-index: 9999; background: #f8fafc; }
      #left-sidebar h3 { color: #0f172a; margin: 0 0 8px 0; font-size: 14px; font-weight: 600; }
      /* make grapes block container use full width inside our box */
      #blocks .gjs-blocks { background: #2d3748; color: #fff; border-radius: 4px; }
      /* keep builder canvas from overlapping */
      #gjs { position: relative; z-index: 10; }
    `;
    document.head.appendChild(styleEl);

    window.gjs = editor; // debug
  }, []);

  // model add/delete
  const addModel = () => {
    if (!modelName) return;
    const newModel = {
      name: modelName.trim(),
      fields: fields.split(",").map((f) => f.trim()).filter(Boolean),
    };
    setModels((prev) => [...prev, newModel]);
    setModelName("");
    setFields("");
  };
  const deleteModel = (idx) => setModels((prev) => prev.filter((_, i) => i !== idx));

  // Preview raw generated page (static preview)
  const handlePreview = () => {
    const editor = editorRef.current;
    if (!editor) return alert("Editor not ready");
    const html = editor.getHtml();
    const css = editor.getCss();
    const full = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`;
    const w = window.open("", "_blank");
    w.document.open();
    w.document.write(full);
    w.document.close();
  };

  // Export: dynamic import JSZip & file-saver so SSR is safe
  const exportProject = async () => {
    const BACKEND_URL = "http://localhost:3001";
    const editor = editorRef.current;
    if (!editor) return alert("Editor not ready");
    const html = editor.getHtml();
    const css = editor.getCss();

    const JSZipModule = await import("jszip");
    const FileSaver = await import("file-saver");
    const JSZip = JSZipModule.default || JSZipModule;
    const { saveAs } = FileSaver;

    const zip = new JSZip();

    // ---------------- FRONTEND (static) ----------------
    const frontend = zip.folder("frontend");
    // index.html
    const indexHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Exported App - Frontend</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <div id="app">${html}</div>
  <script src="./app.js"></script>
</body>
</html>
`;
    frontend.file("index.html", indexHtml);
    frontend.file("styles.css", css || "/* no custom css generated */");

    // app.js: attaches handlers for data-api, data-nav, data-auto forms and also provides a small auth helper for demos
    const appJs = `// app.js -- attaches API handlers and a small auth helper for demo
(function () {
  const BACKEND_URL = "${BACKEND_URL}";
  // attach once
  function attachHandlers() {
    // handle data-api buttons
    document.querySelectorAll("[data-api]").forEach((el) => {
      if (el.__hasHandler) return;
      el.__hasHandler = true;
      el.addEventListener("click", async function (e) {
        try {
          const api = el.getAttribute("data-api");
          const method = el.getAttribute("data-method") || "POST";
          const bodyStr = el.getAttribute("data-body");
          let body = {};
          if (bodyStr) {
            try { body = JSON.parse(bodyStr); } catch (err) { body = bodyStr; }
          }
          const res = await fetch(BACKEND_URL +api, {
            method,
            headers: { "Content-Type": "application/json", Authorization: localStorage.getItem('token') ? 'Bearer ' + localStorage.getItem('token') : undefined },
            body: method !== "GET" ? JSON.stringify(body) : undefined
          });
          const data = await res.json();
          // if auth endpoints return token, store it
          if (data && data.token) {
            localStorage.setItem('token', data.token);
            alert('Auth success (token saved).');
            return;
          }
          alert('Response: ' + JSON.stringify(data));
        } catch (err) {
          alert('API call failed: ' + err.message);
        }
      });
    });

    // navigate buttons
    document.querySelectorAll("[data-nav]").forEach((el) => {
      if (el.__navHandler) return;
      el.__navHandler = true;
      el.addEventListener("click", function () {
        const dest = el.getAttribute("data-nav");
        if (dest) window.location.href = dest;
      });
    });

    // auto-post forms
    document.querySelectorAll("form[data-auto]").forEach((form) => {
      if (form.__formHandler) return;
      form.__formHandler = true;
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const api = form.getAttribute("data-api");
        const method = form.getAttribute("data-method") || "POST";
        const fd = new FormData(form);
        const obj = {};
        for (const [k, v] of fd.entries()) obj[k] = v;
        try {
          const res = await fetch(BACKEND_URL +api, { method, headers: { "Content-Type": "application/json", Authorization: localStorage.getItem('token') ? 'Bearer ' + localStorage.getItem('token') : undefined }, body: JSON.stringify(obj) });
          const data = await res.json();
          alert('Response: ' + JSON.stringify(data));
        } catch (err) {
          alert('Submit failed: ' + err.message);
        }
      });
    });
  }

  // run on load and observe DOM changes (Grapes export may include dynamic elements)
  if (document.readyState === "complete" || document.readyState === "interactive") attachHandlers();
  else window.addEventListener("DOMContentLoaded", attachHandlers);

  // also try to re-attach periodically (helps with SPA-ish changes)
  setInterval(attachHandlers, 1500);
})();
`;
    frontend.file("app.js", appJs);

    // small frontend README
    frontend.file("README.md", `# Frontend (static)
Open frontend/index.html in a browser or serve via a static server:
npx serve frontend
or
python -m http.server 8080
`);

    // ---------------- BACKEND (Express) ----------------
    const backend = zip.folder("backend");
    backend.file(
      "package.json",
      JSON.stringify(
        {
          name: "exported-backend",
          version: "1.0.0",
          scripts: { start: "node api/endpoints.js" },
          dependencies: { express: "^4.18.2", cors: "^2.8.5", "bcryptjs": "^2.4.3", "jsonwebtoken": "^9.0.0" },
        },
        null,
        2
      )
    );

    // Build endpoints: auth + model CRUD (in-memory, easy to replace with DB)
    let endpoints = `// api/endpoints.js
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret_in_production";

// In-memory stores (demo). Replace with a real DB for production.
let users = [];
`;

    // add CRUD arrays for models
    if (models.length === 0) {
      // example fallback model
      endpoints += `let examples = [];\n`;
    } else {
      models.forEach((m) => {
        const plural = m.name.toLowerCase() + "s";
        endpoints += `let ${plural} = [];\n`;
      });
    }

    // Auth endpoints (register/login)
    endpoints += `
// ---------- AUTH ----------
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email & password required" });
  if (users.find((u) => u.email === email)) return res.status(400).json({ error: "user exists" });
  const hashed = await bcrypt.hash(password, 10);
  const u = { id: Date.now(), email, name: name || "", password: hashed };
  users.push(u);
  const token = jwt.sign({ id: u.id, email: u.email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ user: { id: u.id, email: u.email, name: u.name }, token });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const u = users.find((x) => x.email === email);
  if (!u) return res.status(400).json({ error: "invalid credentials" });
  const ok = await bcrypt.compare(password, u.password);
  if (!ok) return res.status(400).json({ error: "invalid credentials" });
  const token = jwt.sign({ id: u.id, email: u.email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ user: { id: u.id, email: u.email, name: u.name }, token });
});

// simple middleware
function authRequired(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "no token" });
  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: "invalid token" });
  }
}

// protected test route
app.get("/api/secure", authRequired, (req, res) => {
  res.json({ message: "Hello from protected route", user: req.user });
});
`;

    // Add CRUD endpoints per model
    if (models.length === 0) {
      endpoints += `
// example simple endpoints
app.get("/api/examples", (req, res) => res.json(examples));
app.post("/api/examples", (req, res) => {
  const it = req.body || {};
  it.id = Date.now();
  examples.push(it);
  res.json(it);
});
`;
    } else {
      models.forEach((m) => {
        const plural = m.name.toLowerCase() + "s";
        const allowedFields = (m.fields || []).map((f) => `"${f}"`).join(", ");
        endpoints += `
// Model: ${m.name}
app.get("/api/${plural}", (req, res) => res.json(${plural}));
app.get("/api/${plural}/:id", (req, res) => {
  const it = ${plural}.find((x) => String(x.id) === String(req.params.id));
  if (!it) return res.status(404).json({ error: "not found" });
  res.json(it);
});
app.post("/api/${plural}", (req, res) => {
  const it = req.body || {};
  it.id = Date.now();
  ${plural}.push(it);
  res.json(it);
});
app.put("/api/${plural}/:id", (req, res) => {
  const idx = ${plural}.findIndex((x) => String(x.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "not found" });
  ${plural}[idx] = { ...${plural}[idx], ...req.body };
  res.json(${plural}[idx]);
});
app.delete("/api/${plural}/:id", (req, res) => {
  ${plural} = ${plural}.filter((x) => String(x.id) !== String(req.params.id));
  res.json({ ok: true });
});
`;
      });
    }

    endpoints += `
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log("Backend running on port " + PORT));
`;

    backend.folder("api").file("endpoints.js", endpoints);

    // simple db placeholder
    const dbPlaceholder = `// db.js - in-memory placeholder
module.exports = {
${models.length > 0 ? models.map((m) => `  ${m.name.toLowerCase()}s: []`).join(",\n") : "  examples: []"}
};
`;
    backend.file("db.js", dbPlaceholder);

    // backend README (instructions + how to switch to MongoDB)
    backend.file(
      "README.md",
      `# Exported Backend (Express demo)
Run:
cd backend
npm install
node api/endpoints.js

This demo uses in-memory arrays for storage (easy for hackathon/demo).
To switch to a real DB (MongoDB + Mongoose), do:

1. npm install mongoose
2. at top of api/endpoints.js:
   const mongoose = require('mongoose');
   mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/myapp', { useNewUrlParser: true, useUnifiedTopology: true });

3. For each model, create a Mongoose schema:
   const UserSchema = new mongoose.Schema({
     name: String,
     email: { type: String, unique: true },
     password: String
   });
   const User = mongoose.model('User', UserSchema);

4. Replace array logic with Mongoose queries:
   // find all
   app.get('/api/users', async (req,res)=> { const items = await User.find(); res.json(items); });

5. Ensure passwords are hashed (bcryptjs) on register before saving.

This file contains auth endpoints (register/login with JWT). Replace the in-memory arrays with DB calls for production.
`
    );

    // Top-level README for zip
    zip.file(
      "README.md",
      `# Exported App (generated by SuperApp)
This ZIP contains:
- frontend/ (static HTML/CSS/JS)
- backend/ (Express API demo with auth + model CRUD)

Frontend: open frontend/index.html (or serve it).
Backend: cd backend && npm install && node api/endpoints.js

Switch to a production DB: see backend/README.md for quick steps to use MongoDB + Mongoose.
`
    );

    // finalize
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "myApp_export.zip");
  };

  // styles for left sidebar & canvas; inline to avoid global conflicts
  const leftStyle = {
    width: 340,
    padding: 14,
    background: "#f8fafc",
    borderRight: "1px solid #e6eef6",
    boxSizing: "border-box",
    overflow: "auto",
  };
  const headingStyle = { margin: 0, padding: "6px 0", color: "#0f172a", fontWeight: 700, fontSize: 14 };
  const blocksBox = { minHeight: 220, background: "#fff", padding: 8, borderRadius: 6, border: "1px solid #e5e7eb" };
  const sideBtn = { width: "100%", padding: 10, borderRadius: 6, border: "none", cursor: "pointer", marginBottom: 8 };

  return (
    <div id="mysty" style={{ display: "flex", height: "100vh", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto" }}>
      <div id="left-sidebar" style={leftStyle}>
        <h3 style={headingStyle}>Blocks</h3>
        <div id="blocks" style={blocksBox}></div>

        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #eef2f7" }} />

        <h3 style={headingStyle}>Models</h3>
        <label style={{ fontSize: 12, color: "#374151" }}>Model name (e.g., User)</label>
        <input
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="User"
          style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 6, border: "1px solid #e5e7eb" }}
        />
        <label style={{ fontSize: 12, color: "#374151" }}>Fields (comma separated)</label>
        <input
          value={fields}
          onChange={(e) => setFields(e.target.value)}
          placeholder="name,email,password"
          style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 6, border: "1px solid #e5e7eb" }}
        />
        <button onClick={addModel} style={{ ...sideBtn, background: "#2563eb", color: "#fff" }}>
          Add Model
        </button>
        <button
          onClick={() => {
            setModels([]);
          }}
          style={{ ...sideBtn, background: "#ef4444", color: "#fff" }}
        >
          Clear
        </button>

        <div>
          {models.map((m, i) => (
            <div key={i} style={{ background: "#fff", padding: 8, borderRadius: 6, border: "1px solid #e5e7eb", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ display: "block" }}>{m.name}</strong>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{m.fields.join(", ")}</span>
                </div>
                <button onClick={() => deleteModel(i)} style={{ background: "#f97316", color: "#fff", border: "none", padding: "6px 8px", borderRadius: 6 }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #eef2f7" }} />

        <h3 style={headingStyle}>Preview & Export</h3>
        <button onClick={handlePreview} style={{ ...sideBtn, background: "#fff", border: "1px solid #e5e7eb" }}>
          Preview Page
        </button>
        <button onClick={exportProject} style={{ ...sideBtn, background: "#10b981", color: "#fff" }}>
          Export Full-Stack Zip
        </button>
      </div>

      <div id="gjs" style={{ flex: 1, background: "#fff", overflow: "auto" }}></div>
    </div>
  );
}
