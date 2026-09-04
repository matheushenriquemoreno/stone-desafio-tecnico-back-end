# Bug — `start:dev` falha na injeção do `ConfigService`

| Status       | Resolvido       |
|--------------|-----------------|
| Created      | 2026-09-04      |
| Last Updated | 2026-09-04      |

## Comportamento esperado e observado

**Esperado:** `npm run start:dev` deve iniciar a API com o mesmo bootstrap de
`npm run start`, carregando o `ConfigService` e registrando as rotas.

**Observado:** a aplicação falha durante a criação de
`CookieAccessTokenStrategy` com `TypeError: Cannot read properties of undefined
(reading 'getOrThrow')` em `cookie-access-token.strategy.ts:58`. O segundo
parâmetro `configService` chega como `undefined`.

## Contexto e evidências

- **Entradas:** `.env` válido e `npm run start:dev`.
- **Ambiente:** Windows, NestJS, TypeScript estrito e `tsx watch`.
- **Frequência:** reproduzível no modo de desenvolvimento.
- **Evidências:** a reprodução local com `.env` de teste produziu o mesmo
  `TypeError` na linha 58; `npm run start` com `dist/main.js` iniciou
  corretamente no mesmo ambiente.

## Reprodução

1. Disponibilizar um `.env` válido conforme `.env.example`.
2. Executar `npm run start:dev`.
3. Observar a falha durante a criação dos providers do `AuthModule`.

**Confirmação:** sim. A saída apresenta exatamente o `TypeError` relatado e a
linha `configService.getOrThrow(...)` do construtor.

## Hipóteses testadas e resultados

| # | Hipótese | Teste (uma variável por vez) | Resultado |
|---|----------|------------------------------|-----------|
| H1 | O runner `tsx` não emite metadata `design:paramtypes` dos decorators legados. | Comparar a saída esbuild usada pelo `tsx` com o JavaScript emitido por `tsc`: o build contém `__metadata("design:paramtypes", [Object, ConfigService])`, enquanto esbuild não contém esse metadata; a execução reproduzida falhou no parâmetro sem token explícito. | Confirmada |
| H2 | O problema é ausência ou formato inválido do `.env`. | Executar o build compilado com o mesmo ambiente válido; `npm run start` inicializa e registra as rotas. | Refutada |

## Causa raiz confirmada

`tsx watch` usa esbuild para transpilar `src/main.ts`. O esbuild remove o
metadata de parâmetros necessário pelo Nest para injeção baseada em
`emitDecoratorMetadata`; por isso o parâmetro `ConfigService` sem `@Inject`
explícito não recebe token de resolução e chega como `undefined`. O build via
`tsc` preserva o metadata e não apresenta o erro.

## Proposta de correção

Trocar o runner do script `start:dev` para `tsc-watch -p
tsconfig.build.json`, executando o JavaScript compilado em `dist` após cada
compilação bem-sucedida. Isso preserva a emissão de metadata do TypeScript,
evita gerar arquivos dentro de `src`/`test` e mantém observação/reinício sem
alterar o contrato de injeção nem espalhar `@Inject` nos providers.

## Teste de regressão

Executar `npm run start:dev` com ambiente válido e verificar que o bootstrap
termina sem `TypeError`, registra as rotas e permanece ativo para receber
requisições.

## Validações realizadas

- Teste de regressão antes da correção: `npm run start:dev` falhou com o
  `TypeError` relatado no bootstrap.
- Correção aplicada: script `start:dev` alterado para `tsc-watch -p
  tsconfig.build.json --onSuccess "node dist/main.js"`, com compilação
  TypeScript em modo watch e dependência de desenvolvimento adicionada.
- Primeira validação da correção: o bootstrap iniciou, mas o comando sem `-p`
  gerou 208 arquivos `.js`/mapas e 104 declarações `.d.ts` em `src`, `test` e
  `scripts`; eles foram removidos por serem saída gerada e não parte do projeto.
- Teste de regressão depois da correção final: `npm run start:dev` compilou com
  `tsconfig.build.json`, iniciou o NestJS, registrou todas as rotas e
  `GET /docs-json` retornou `200`.
- Reprodução original: não reproduzida após a correção; o parâmetro
  `configService` foi resolvido durante a inicialização.
- Testes relevantes do projeto: `npm ci`, lint, typecheck, build, suíte
  unitária (24 suítes/104 testes) e `git diff --check` passaram; não há
  artefatos de compilação em `src`, `test` ou `scripts`, e o `.env` temporário
  não foi versionado.

## Riscos e prevenções futuras

- O modo de desenvolvimento ficará dependente do ciclo de build incremental;
  o script deve falhar claramente se a compilação não produzir `dist/main.js`.
- O runner de desenvolvimento não deve voltar a transpilar diretamente os
  decorators Nest com um compilador que omita metadata sem teste de bootstrap.
