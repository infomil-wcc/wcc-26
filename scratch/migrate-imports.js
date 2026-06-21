const fs = require('fs');
const path = require('path');

// Helper to fix lighten/darken calls in a file
function fixColorFunctions(content) {
  let needsColorUse = false;
  let fixed = content;
  
  if (fixed.includes('lighten(') || fixed.includes('darken(')) {
    fixed = fixed.replace(/lighten\(([^,]+),\s*([^)]+)\)/g, 'color.adjust($1, $lightness: $2)');
    fixed = fixed.replace(/darken\(([^,]+),\s*([^)]+)\)/g, 'color.adjust($1, $lightness: -$2)');
    needsColorUse = true;
  }
  
  if (needsColorUse && !fixed.includes('sass:color')) {
    fixed = `@use "sass:color";\n` + fixed;
  }
  
  return { fixed, changed: fixed !== content };
}

// 1. Fix variables.scss
const varsPath = path.join(__dirname, '..', 'src', 'variables.scss');
if (fs.existsSync(varsPath)) {
  let content = fs.readFileSync(varsPath, 'utf8');
  const res = fixColorFunctions(content);
  if (res.changed) {
    fs.writeFileSync(varsPath, res.fixed, 'utf8');
    console.log('Fixed variables.scss');
  }
}

// 2. Recursively find all scss files
function migrateDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.angular') {
        migrateDir(fullPath);
      }
    } else if (file.endsWith('.scss')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      // Fix color functions first
      const colorRes = fixColorFunctions(content);
      if (colorRes.changed) {
        content = colorRes.fixed;
        changed = true;
      }
      
      // Match @import "path/to/variables.scss"; or @import "variables.scss"; or with single quotes
      const importRegex = /@import\s+['"]([^'"]+)['"]\s*;/g;
      
      content = content.replace(importRegex, (match, importPath) => {
        if (importPath.startsWith('http') || importPath.includes('fonts.googleapis.com')) {
          return match;
        }
        changed = true;
        
        let cleanPath = importPath;
        if (cleanPath.endsWith('.scss')) {
          cleanPath = cleanPath.slice(0, -5);
        }
        
        return `@use "${cleanPath}" as *;`;
      });
      
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Migrated: ${path.relative(path.join(__dirname, '..'), fullPath)}`);
      }
    }
  }
}

migrateDir(path.join(__dirname, '..', 'src'));
console.log('Migration completed!');
