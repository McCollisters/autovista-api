const fs = require("fs");
const path = require("path");

const dir = path.resolve(__dirname, "dist");
const srcDir = path.resolve(__dirname, "src");

function processDir(directory) {
  const files = fs.readdirSync(directory);

  files.forEach((file) => {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (file.endsWith(".js")) {
      fixFileImports(fullPath);
    }
  });
}

function convertAliasToRelative(filePath, aliasPath) {
  // Remove @/ prefix and get the target path
  const targetPath = aliasPath.replace(/^@\//, "");
  // Target is in dist directory (same structure as src)
  const targetFullPath = path.join(dir, targetPath);
  
  // Get the directory of the current file
  const currentDir = path.dirname(filePath);
  
  // Calculate relative path from current file to target
  let relativePath = path.relative(currentDir, targetFullPath);
  
  // Ensure path uses forward slashes and starts with ./
  relativePath = relativePath.replace(/\\/g, "/");
  if (!relativePath.startsWith(".")) {
    relativePath = "./" + relativePath;
  }
  
  // Add .js extension if not present
  if (!relativePath.match(/\.(js|json|node)$/)) {
    relativePath += ".js";
  }
  
  return relativePath;
}

function fixFileImports(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let replacedCount = 0;

  // Fix @/ path aliases in static imports: import ... from "@/path"
  const staticImportRegex = /(import\s(?:.+?\sfrom\s)?|require\()\s*(['"])(@\/[^'"]+?)\2/g;
  content = content.replace(
    staticImportRegex,
    (match, p1, quote, aliasPath) => {
      replacedCount++;
      const relativePath = convertAliasToRelative(filePath, aliasPath);
      return `${p1}${quote}${relativePath}${quote}`;
    },
  );

  // Fix @/ path aliases in dynamic imports: import("@/path") or await import("@/path")
  const dynamicImportRegex = /(import\s*\(|await\s+import\s*\()\s*(['"])(@\/[^'"]+?)\2/g;
  content = content.replace(
    dynamicImportRegex,
    (match, p1, quote, aliasPath) => {
      replacedCount++;
      const relativePath = convertAliasToRelative(filePath, aliasPath);
      return `${p1}${quote}${relativePath}${quote}`;
    },
  );

  // Fix relative imports without .js extension
  const relativeImportRegex =
    /(import\s(?:.+?\sfrom\s)?|require\()\s*(['"])(\.{1,2}\/[^'"]+?)\2/g;
  content = content.replace(
    relativeImportRegex,
    (match, p1, quote, importPath) => {
      if (importPath.match(/\.(js|json|node)$/)) {
        return match;
      }
      replacedCount++;
      return `${p1}${quote}${importPath}.js${quote}`;
    },
  );

  if (replacedCount > 0) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`Fixed ${replacedCount} imports in ${filePath}`);
  } else {
    console.log(`No imports fixed in ${filePath}`);
  }
}

processDir(dir);
