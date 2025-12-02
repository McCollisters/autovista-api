const fs = require("fs");
const path = require("path");

const dir = path.resolve(__dirname, "dist");

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

function fixFileImports(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  const fileDir = path.dirname(filePath);
  const distDir = path.resolve(__dirname, "dist");
  
  let replacedCount = 0;
  let newContent = content;

  // Fix @/ path aliases - convert to relative paths
  // @/ maps to src/, and in dist it should map to ./
  const aliasRegex = /(import\s(?:.+?\sfrom\s)?|require\()\s*(['"])(@\/[^'"]+?)\2/g;
  newContent = newContent.replace(aliasRegex, (match, p1, quote, importPath) => {
    // Remove @/ prefix
    const relativePath = importPath.replace(/^@\//, "");
    
    // Calculate relative path from current file to the target
    const targetPath = path.join(distDir, relativePath);
    const relative = path.relative(fileDir, targetPath);
    
    // Convert to forward slashes and ensure it starts with ./
    let finalPath = relative.replace(/\\/g, "/");
    if (!finalPath.startsWith(".")) {
      finalPath = "./" + finalPath;
    }
    
    // Add .js extension if not present
    if (!finalPath.match(/\.(js|json|node)$/)) {
      finalPath += ".js";
    }
    
    replacedCount++;
    return `${p1}${quote}${finalPath}${quote}`;
  });

  // Fix relative imports - add .js extension if missing
  const relativeRegex = /(import\s(?:.+?\sfrom\s)?|require\()\s*(['"])(\.{1,2}\/[^'"]+?)\2/g;
  newContent = newContent.replace(relativeRegex, (match, p1, quote, importPath) => {
    if (importPath.match(/\.(js|json|node)$/)) {
      return match;
    }
    replacedCount++;
    return `${p1}${quote}${importPath}.js${quote}`;
  });

  if (replacedCount > 0) {
    fs.writeFileSync(filePath, newContent, "utf8");
    console.log(`Fixed ${replacedCount} imports in ${filePath}`);
  } else {
    console.log(`No imports fixed in ${filePath}`);
  }
}

processDir(dir);
