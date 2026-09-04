export interface AcceptanceCriterionEvidence {
  readonly id: number;
  readonly requirements: string;
  readonly summary: string;
  readonly testPaths: readonly string[];
}

export const ACCEPTANCE_CRITERIA: readonly AcceptanceCriterionEvidence[] = [
  { id: 1, requirements: 'AAP-01..09', summary: 'Cadastro válido cria uma conta única com resposta pública.', testPaths: ['test/e2e/register-user.e2e.spec.ts'] },
  { id: 2, requirements: 'AAP-04, AAP-05, AAP-07', summary: 'Normalização de e-mail precede a unicidade.', testPaths: ['test/e2e/register-user.e2e.spec.ts'] },
  { id: 3, requirements: 'AAP-07, AAP-50', summary: 'Conflito de e-mail normalizado retorna código estável.', testPaths: ['test/e2e/register-user.e2e.spec.ts'] },
  { id: 4, requirements: 'AAP-10..13', summary: 'Login válido cria cookie HttpOnly sem JWT no corpo.', testPaths: ['test/e2e/login.e2e.spec.ts', 'src/modules/auth/presentation/auth-cookie.spec.ts'] },
  { id: 5, requirements: 'AAP-14, AAP-15, AAP-50', summary: 'Credencial inválida é genérica e não cria cookie.', testPaths: ['test/e2e/login.e2e.spec.ts'] },
  { id: 6, requirements: 'AAP-16, AAP-17', summary: 'Logout expira o cookie em todos os estados.', testPaths: ['test/e2e/logout.e2e.spec.ts'] },
  { id: 7, requirements: 'AAP-18, AAP-19, AAP-50', summary: 'Produto sem cookie válido retorna UNAUTHORIZED.', testPaths: ['test/e2e/access-token-guard.e2e.spec.ts', 'test/e2e/get-product.e2e.spec.ts'] },
  { id: 8, requirements: 'AAP-21, AAP-22, AAP-50', summary: 'Mutação sem CSRF/origem autorizada é recusada.', testPaths: ['test/e2e/csrf.e2e.spec.ts', 'test/e2e/create-product.e2e.spec.ts'] },
  { id: 9, requirements: 'AAP-20, AAP-23, AAP-24', summary: 'Preflight autorizado não autentica nem consome operação.', testPaths: ['test/e2e/cors.e2e.spec.ts', 'test/e2e/rate-limit.e2e.spec.ts'] },
  { id: 10, requirements: 'AAP-25..30', summary: 'Produto válido é criado com o recurso completo.', testPaths: ['test/e2e/create-product.e2e.spec.ts'] },
  { id: 11, requirements: 'AAP-26..29, AAP-51, AAP-52', summary: 'Campos de produto inválidos produzem erro seguro.', testPaths: ['test/e2e/create-product.e2e.spec.ts'] },
  { id: 12, requirements: 'AAP-31, AAP-36', summary: 'Catálogo vazio omite nextCursor.', testPaths: ['test/e2e/list-products.e2e.spec.ts'] },
  { id: 13, requirements: 'AAP-32..35', summary: 'Listagem limitada devolve cursor para continuação.', testPaths: ['test/e2e/list-products.e2e.spec.ts'] },
  { id: 14, requirements: 'AAP-33, AAP-34', summary: 'Limite padrão e intervalo inteiro são aplicados.', testPaths: ['test/e2e/list-products.e2e.spec.ts'] },
  { id: 15, requirements: 'AAP-32, AAP-37', summary: 'Cursor é reenviado opacamente e inválido é rejeitado.', testPaths: ['test/e2e/list-products.e2e.spec.ts', 'src/modules/products/infrastructure/persistence/dynamodb-cursor-codec.spec.ts'] },
  { id: 16, requirements: 'AAP-30, AAP-38', summary: 'Produto existente é consultado por identificador.', testPaths: ['test/e2e/get-product.e2e.spec.ts'] },
  { id: 17, requirements: 'AAP-39, AAP-40, AAP-44', summary: 'Patch válido altera somente campos presentes.', testPaths: ['test/e2e/update-product.e2e.spec.ts', 'src/modules/products/application/update-product/update-product.spec.ts'] },
  { id: 18, requirements: 'AAP-41..43', summary: 'Patch vazio, nulo ou desconhecido não altera o produto.', testPaths: ['test/e2e/update-product.e2e.spec.ts'] },
  { id: 19, requirements: 'AAP-45', summary: 'Exclusão existente retorna 204 sem corpo.', testPaths: ['test/e2e/delete-product.e2e.spec.ts'] },
  { id: 20, requirements: 'AAP-46..48, AAP-50', summary: 'Ausência individual retorna PRODUCT_NOT_FOUND.', testPaths: ['test/e2e/get-product.e2e.spec.ts', 'test/e2e/update-product.e2e.spec.ts', 'test/e2e/delete-product.e2e.spec.ts'] },
  { id: 21, requirements: 'AAP-49', summary: 'Catálogo é compartilhado entre contas autenticadas.', testPaths: ['test/e2e/get-product.e2e.spec.ts', 'test/e2e/update-product.e2e.spec.ts', 'test/e2e/delete-product.e2e.spec.ts'] },
  { id: 22, requirements: 'AAP-53..55', summary: 'Próxima requisição recebe 429, código e Retry-After.', testPaths: ['test/e2e/rate-limit.e2e.spec.ts', 'src/shared/presentation/errors/api-exception.filter.spec.ts'] },
  { id: 23, requirements: 'AAP-53', summary: 'Buckets isolam IP, método e operação.', testPaths: ['src/shared/infrastructure/rate-limit/in-memory-fixed-window-rate-limiter.spec.ts', 'src/shared/presentation/http/rate-limit.middleware.spec.ts'] },
  { id: 24, requirements: 'AAP-58, AAP-59', summary: 'Readiness positivo e indisponibilidade são distinguíveis.', testPaths: ['test/e2e/health.e2e.spec.ts', 'src/modules/health/application/use-cases/check-readiness.spec.ts'] },
  { id: 25, requirements: 'AAP-56, AAP-57, EXPECT-06', summary: 'OpenAPI UI e JSON descrevem o contrato.', testPaths: ['test/e2e/openapi.e2e.spec.ts', 'test/e2e/register-user.e2e.spec.ts'] },
  { id: 26, requirements: 'EXPECT-07, EXPECT-08', summary: 'Suítes funcionais, persistência isolada e gates são executáveis.', testPaths: ['test/integration/products.integration.spec.ts', 'test/e2e/rate-limit.e2e.spec.ts', 'package.json'] },
  { id: 27, requirements: 'EXPECT-01, EXPECT-02, EXPECT-10, EXPECT-11', summary: 'Respostas, logs e artefatos não expõem material sensível.', testPaths: ['test/e2e/errors.e2e.spec.ts', 'test/e2e/register-user.e2e.spec.ts', 'test/e2e/access-token-guard.e2e.spec.ts'] },
];
