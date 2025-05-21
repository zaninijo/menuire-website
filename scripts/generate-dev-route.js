import fs from 'fs';
import path from 'path';

const basePath = path.resolve('./routes.base.json');
const devPath = path.resolve('./routes.json');

const baseRoutes = JSON.parse(fs.readFileSync(basePath, 'utf-8'));

const devRoutes = Object.fromEntries(
  Object.entries(baseRoutes).map(([key, value]) => {
    const cleanPath = value.endsWith('/') ? value.slice(0, -1) : value;
    const newPath = cleanPath === '/' ? '/index.html' : `${cleanPath}.html`;
    return [key, newPath];
  })
);

fs.writeFileSync(devPath, JSON.stringify(devRoutes, null, 2));
console.log('Rotas atualizadas para o servidor de desenvolvimento');
