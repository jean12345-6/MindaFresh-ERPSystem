const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const views = path.join(root, 'views');
const templates = {};
for (const file of fs.readdirSync(views)) {
  if (file.endsWith('.xian')) templates[file.replace('.xian', '')] = fs.readFileSync(path.join(views, file), 'utf8');
}
const partials = {};
function collectPartials(directory, prefix = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectPartials(fullPath, prefix + entry.name + '/');
    else if (entry.name.endsWith('.xian')) partials[prefix + entry.name.replace('.xian', '')] = fs.readFileSync(fullPath, 'utf8');
  }
}
collectPartials(path.join(views, 'partials'));
fs.writeFileSync(path.join(root, 'dist/js/templates.js'), 'export const templates = ' + JSON.stringify(templates) + ';\nexport const partials = ' + JSON.stringify(partials) + ';\n');
fs.copyFileSync(require.resolve('handlebars/dist/handlebars.js'), path.join(root, 'dist/js/handlebars.js'));
fs.copyFileSync(path.join(root, 'public/css/app.css'), path.join(root, 'dist/css/app.css'));
fs.copyFileSync(path.join(root, 'public/css/utilities.css'), path.join(root, 'dist/css/utilities.css'));
fs.writeFileSync(path.join(root, 'dist/js/payrollMath.js'), fs.readFileSync(path.join(root, 'services/payrollMath.js'), 'utf8').replace('../config/payroll.js', './payrollConfig.js'));
fs.copyFileSync(path.join(root, 'config/payroll.js'), path.join(root, 'dist/js/payrollConfig.js'));
console.log('Demo built from the actual .xian page templates.');

fs.copyFileSync(path.join(root, 'public/js/sidebar.js'), path.join(root, 'dist/js/sidebar.js'));

fs.mkdirSync(path.join(root, 'dist/images'), { recursive: true });
fs.copyFileSync(path.join(root, 'public/images/mindafresh-logo.svg'), path.join(root, 'dist/images/mindafresh-logo.svg'));
