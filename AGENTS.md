# Instruções para agentes

## Idioma

Responda ao usuário em português do Brasil.

## Leitura obrigatória antes de implementar

Antes de criar ou alterar qualquer código de produção, teste, script ou infraestrutura:

1. Leia integralmente o índice em [`rules/README.md`](./rules/README.md).
2. Leia todos os documentos indicados na seção **Leitura obrigatória** desse índice.
3. Consulte os requisitos, o design técnico, o plano, o estado da implementação e as ADRs relacionados à tarefa.
4. Verifique o código existente e siga o vocabulário e os padrões já estabelecidos quando estiverem de acordo com esses documentos.

Essa leitura também é obrigatória para correções de bugs e refatorações. Uma alteração exclusivamente documental exige apenas os documentos pertinentes ao seu escopo.

## Aplicação das regras

- Trate `rules/` como a fonte de verdade para o padrão de escrita de software deste repositório.
- KISS, DRY, SOLID e código como um livro devem orientar decisões concretas; não os use para justificar abstrações especulativas.
- A simplicidade não pode violar requisitos, contratos, segurança ou decisões arquiteturais aprovadas.
- Em caso de conflito documental, interrompa a implementação, identifique o conflito e peça uma decisão em vez de escolher silenciosamente.
- Antes de concluir uma mudança, execute o checklist em [`rules/checklist-de-implementacao.md`](./rules/checklist-de-implementacao.md) e as validações aplicáveis do projeto.

