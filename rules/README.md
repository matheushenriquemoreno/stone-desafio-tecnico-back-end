# Regras de desenvolvimento

Esta pasta registra como o software deste repositório deve ser escrito. O objetivo é produzir código simples, expressivo e seguro para manutenção: uma pessoa desenvolvedora deve conseguir entender a regra de negócio lendo o código, sem precisar decifrar abstrações ou reconstruir intenções ocultas.

Estas regras valem para código de produção, testes, scripts e infraestrutura. Elas complementam os requisitos, o design técnico e as ADRs; não substituem decisões já aprovadas nesses documentos.

## Leitura obrigatória

Antes de implementar ou alterar código, leia nesta ordem:

1. [Princípios de design](./principios-de-design.md): KISS, DRY e SOLID, com critérios para aplicá-los sem excesso de abstração.
2. [Código como um livro](./codigo-como-um-livro.md): nomes, funções, fluxo, comentários, erros e testes que tornam a intenção explícita.
3. [Checklist de implementação](./checklist-de-implementacao.md): verificação prática antes, durante e depois de cada mudança.

## Regra central

> Escolha a solução mais simples que expresse corretamente a regra de negócio, respeite os contratos aprovados e permaneça fácil de testar e alterar.

Simplicidade não significa ignorar a arquitetura, remover validações ou concentrar responsabilidades. Significa evitar complexidade que o problema atual não exige.

## Ordem de decisão

Quando houver dúvida entre abordagens:

1. Preserve o comportamento, os requisitos e os contratos aprovados.
2. Respeite as decisões arquiteturais vigentes.
3. Prefira clareza e simplicidade para quem lê.
4. Remova duplicação de conhecimento, não apenas trechos visualmente parecidos.
5. Crie abstrações somente quando existir uma responsabilidade ou variação concreta.
6. Otimize desempenho depois de identificar uma necessidade mensurável, salvo quando o requisito já exigir isso.

KISS, DRY, SOLID e Clean Code são instrumentos de decisão, não metas isoladas. Se a aplicação mecânica de um princípio tornar o código mais indireto, genérico ou difícil de explicar, volte ao problema e procure uma solução menor.

## Referência inicial

- [KISS Software Design Principle](https://www.baeldung.com/cs/kiss-software-design-principle)

