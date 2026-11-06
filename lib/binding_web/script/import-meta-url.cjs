// Stands in for import.meta.url in the CommonJS bundle (see script/build.ts).
export const importMetaUrl = require('url').pathToFileURL(__filename).href;
