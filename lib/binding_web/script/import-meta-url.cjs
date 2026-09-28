// Stands in for import.meta.url in the CommonJS bundle (see script/build.js).
export const importMetaUrl = require('url').pathToFileURL(__filename).href;
