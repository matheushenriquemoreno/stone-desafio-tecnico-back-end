# Checklist de implementação

Use este checklist em código novo, correções e refatorações. Ele orienta a análise; não substitui os critérios de aceitação da tarefa.

## Antes de escrever código

- [ ] Li os requisitos, o design técnico, a fase do plano e as ADRs relacionados.
- [ ] Consultei o estado atual da implementação e confirmei o escopo da tarefa.
- [ ] Consigo descrever a regra de negócio em poucas frases.
- [ ] Identifiquei as entradas, saídas, invariantes, falhas e efeitos colaterais.
- [ ] Procurei implementações e padrões existentes antes de criar outra solução.
- [ ] Escolhi a abordagem mais simples que respeita a arquitetura e o contrato.
- [ ] Evitei antecipar extensões, integrações ou configurações fora do escopo.

## Enquanto implementa

- [ ] Os nomes usam a linguagem do domínio e revelam intenção.
- [ ] O fluxo principal pode ser lido de cima para baixo.
- [ ] Cada camada mantém sua responsabilidade.
- [ ] Dependências externas ficam atrás das fronteiras previstas pela arquitetura.
- [ ] Regras repetidas possuem uma única fonte de verdade.
- [ ] Abstrações novas têm uma necessidade concreta e um nome preciso.
- [ ] Estados inválidos e erros esperados são explícitos.
- [ ] Não introduzi `any`, valores mágicos, parâmetros booleanos ou código morto.
- [ ] Comentários explicam decisões, não repetem instruções.
- [ ] Os testes descrevem comportamento observável e incluem falhas relevantes.

## Antes de concluir

- [ ] Reli a mudança como uma história e simplifiquei trechos difíceis de explicar.
- [ ] Removi duplicações, arquivos, imports e caminhos que ficaram obsoletos.
- [ ] Confirmei que a implementação cumpre os critérios de aceitação.
- [ ] Executei formatação, lint, verificação de tipos, testes e build aplicáveis.
- [ ] Revisei o diff completo e não alterei arquivos fora do escopo sem necessidade.
- [ ] Atualizei documentação e exemplos afetados pelo novo comportamento.
- [ ] Registrei limitações reais sem adicionar complexidade especulativa para escondê-las.

## Perguntas para o review

1. A regra de negócio está visível no código ou escondida em detalhes técnicos?
2. Uma pessoa nova no projeto entenderia os nomes e o fluxo sem explicação oral?
3. Há uma solução menor que mantém os mesmos contratos, testes e legibilidade?
4. A abstração reduz conhecimento duplicado ou apenas reduz linhas repetidas?
5. Cada dependência aponta na direção definida pela arquitetura?
6. Os testes demonstram o comportamento esperado e protegem a mudança?

