import { QueryFailedError } from 'typeorm';

type RepositoryMethod =
  | 'create'
  | 'save'
  | 'find'
  | 'findBy'
  | 'findOne'
  | 'findOneBy'
  | 'findAndCount'
  | 'count'
  | 'existsBy'
  | 'update'
  | 'delete'
  | 'query'
  | 'createQueryBuilder';

export type MockRepository = Record<RepositoryMethod, jest.Mock> & {
  manager: { transaction: jest.Mock };
};

/** jest.fn() for every Repository method the services use. */
export function createMockRepository(): MockRepository {
  return {
    create: jest.fn((entity: unknown) => ({ ...(entity as object) })),
    save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    find: jest.fn(),
    findBy: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    existsBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: { transaction: jest.fn() },
  };
}

/** A TypeORM QueryFailedError carrying a PostgreSQL error code/constraint. */
export function pgError(code: string, constraint?: string): QueryFailedError {
  const driverError = Object.assign(new Error('pg error'), {
    code,
    constraint,
  });
  return new QueryFailedError('SQL', [], driverError);
}

/** Mock of `createQueryBuilder().relation(...).of(...)` for many-to-many ops. */
export function createMockRelation() {
  return {
    loadMany: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    addAndRemove: jest.fn(),
  };
}

export function queryBuilderFor(
  relation: ReturnType<typeof createMockRelation>,
) {
  return { relation: () => ({ of: () => relation }) };
}
