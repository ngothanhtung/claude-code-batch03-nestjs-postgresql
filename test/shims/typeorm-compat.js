// CommonJS stand-in for @nestjs/typeorm/dist/common/typeorm-compat.js, which
// uses `import.meta.url` and so cannot run under Jest's CommonJS runtime.
// Same behaviour: lazily resolve symbols removed in TypeORM v1.
function resolveTypeormExport(exportName) {
  try {
    return require('typeorm')[exportName];
  } catch {
    return undefined;
  }
}

module.exports = {
  Connection: resolveTypeormExport('Connection'),
  AbstractRepository: resolveTypeormExport('AbstractRepository'),
};
