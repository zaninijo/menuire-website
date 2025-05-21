import fs from 'fs';
import path from 'path';

fs.copyFileSync(
  path.resolve('./routes.base.json'),
  path.resolve('./routes.json')
);
console.log('Rotas atualizadas para o bundling.');
