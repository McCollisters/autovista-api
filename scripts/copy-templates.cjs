const path = require("path");
const { mkdir, cp, stat } = require("fs/promises");

const srcDir = path.join(process.cwd(), "src", "templates");
const distDir = path.join(process.cwd(), "dist", "templates");

const ensureDir = async (dir) => {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    console.error("Failed to create directory:", dir, error);
    throw error;
  }
};

const exists = async (target) => {
  try {
    await stat(target);
    return true;
  } catch (error) {
    return false;
  }
};

const run = async () => {
  if (!(await exists(srcDir))) {
    console.warn("Template source directory not found:", srcDir);
    return;
  }

  await ensureDir(distDir);
  await cp(srcDir, distDir, { recursive: true });
  console.log("Copied templates to dist:", distDir);
};

run().catch((error) => {
  console.error("Failed to copy templates:", error);
  process.exit(1);
});
