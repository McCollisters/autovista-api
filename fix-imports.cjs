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

  // Regex to match import and require paths starting with ./ or ../ without .js/.json/.node
  const importRegex =
    /(import\s(?:.+?\sfrom\s)?|require\()\s*(['"])(\.{1,2}\/[^'"]+?)\2/g;

  let replacedCount = 0;
  const newContent = content.replace(
    importRegex,
    (match, p1, quote, importPath) => {
      if (importPath.match(/\.(js|json|node)$/)) {
        return match;
      }
      replacedCount++;
      return `${p1}${quote}${importPath}.js${quote}`;
    },
  );

  if (replacedCount > 0) {
    fs.writeFileSync(filePath, newContent, "utf8");
    console.log(`Fixed ${replacedCount} imports in ${filePath}`);
  } else {
    console.log(`No imports fixed in ${filePath}`);
  }
}

processDir(dir);
