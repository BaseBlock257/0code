// pages/api/saveProject.js
import fs from "fs";
import path from "path";

export default function handler(req, res) {
  if (req.method === "POST") {
    try {
      const { project, title } = req.body;

      if (!project || !title) {
        return res.status(400).json({ ok: false, error: "Missing project or title" });
      }

      // Ensure projects folder exists
      const folder = path.join(process.cwd(), "public", "projects");
      if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

      const timestamp = Date.now();

      // Save JSON version
      const jsonFile = path.join(folder, `${title}-${timestamp}.json`);
      fs.writeFileSync(jsonFile, JSON.stringify(project));

      // Save full HTML file
      const htmlFile = path.join(folder, `${title}-${timestamp}.html`);
      const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
${project.css}
</style>
</head>
<body>
${project.html}
</body>
</html>
`;
      fs.writeFileSync(htmlFile, fullHtml);

      res.status(200).json({
        ok: true,
        message: "Project saved successfully",
        jsonPath: `/projects/${title}-${timestamp}.json`,
        htmlPath: `/projects/${title}-${timestamp}.html`,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: err.message });
    }
  } else {
    res.status(405).json({ ok: false, error: "Method not allowed" });
  }
}
