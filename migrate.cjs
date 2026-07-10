const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.spec.ts')) {
            results.push(file);
        }
    });
    return results;
}

const specFiles = walk('src');

for (const file of specFiles) {
  let content = fs.readFileSync(file, 'utf8');

  // Add vitest imports
  if (!content.includes("from 'vitest'")) {
    content = "import { describe, it, expect, beforeEach, vi } from 'vitest';\n" + content;
  }

  // Replace jasmine.createSpyObj('name', ['method1', 'method2']) with { method1: vi.fn(), method2: vi.fn() }
  content = content.replace(/jasmine\.createSpyObj\([^,]+,\s*\[([^\]]+)\]\)/g, (match, methods) => {
    const methodNames = methods.split(',').map(s => s.trim().replace(/['"]/g, ''));
    let objStr = '{ ';
    methodNames.forEach(m => {
      if (m) objStr += m + ': vi.fn(), ';
    });
    objStr += '}';
    return objStr;
  });
  
  // Replace jasmine.createSpyObj<Type>('name', ['method1'])
  content = content.replace(/jasmine\.createSpyObj<[^>]+>\([^,]+,\s*\[([^\]]+)\]\)/g, (match, methods) => {
    const methodNames = methods.split(',').map(s => s.trim().replace(/['"]/g, ''));
    let objStr = '{ ';
    methodNames.forEach(m => {
      if (m) objStr += m + ': vi.fn(), ';
    });
    objStr += '} as any';
    return objStr;
  });

  // Replace jasmine.createSpy
  content = content.replace(/jasmine\.createSpy\([^)]*\)/g, 'vi.fn()');
  
  // Replace jasmine.any
  content = content.replace(/jasmine\.any\(([^)]+)\)/g, 'expect.any($1)');

  fs.writeFileSync(file, content);
}

console.log('Migrated ' + specFiles.length + ' files');
