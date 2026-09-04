# Código como um livro

O código deve contar a história da regra de negócio em uma ordem natural. Uma pessoa desenvolvedora júnior deve reconhecer o fluxo principal; uma pessoa sênior deve conseguir avaliar contratos, invariantes e efeitos colaterais sem procurar intenções escondidas.

## Use a linguagem do domínio

- Use nomes em inglês no código e mantenha o mesmo termo para o mesmo conceito.
- Prefira nomes do negócio, como `product`, `price`, `owner` e `nextCursor`, a nomes técnicos genéricos como `data`, `item`, `obj` ou `manager`.
- Nomeie ações com verbos e resultados ou conceitos com substantivos.
- Evite abreviações que não pertençam ao vocabulário conhecido do projeto.
- Preserve os termos definidos nos requisitos e contratos; não crie sinônimos desnecessários.

```ts
// Evite
const result = await repo.get(dto.id);

// Prefira
const product = await productRepository.findById(input.productId);
```

## Faça funções contarem uma etapa da história

- Cada função deve operar em um único nível de abstração.
- Mantenha o fluxo principal curto e visível.
- Extraia uma etapa quando ela tiver um nome de negócio útil.
- Evite parâmetros booleanos; eles escondem duas operações atrás da mesma assinatura.
- Prefira poucos argumentos relacionados ou um objeto de entrada nomeado.
- Efeitos colaterais devem ser explícitos no nome ou na posição da chamada.

```ts
// Evite: é necessário simular mentalmente condições e efeitos.
async function handle(input: UpdateProductInput, notify: boolean) {
  const item = await repository.findById(input.id);
  if (item) {
    if (input.price !== undefined && input.price > 0) {
      item.price = input.price;
      await repository.save(item);
      if (notify) await events.publish(item);
    }
  }
}
```

```ts
// Prefira: o caminho principal lê como uma sequência de decisões do domínio.
async function updateProduct(input: UpdateProductInput): Promise<Product> {
  const product = await findExistingProduct(input.productId);

  product.updatePrice(input.price);
  await productRepository.save(product);

  return product;
}
```

## Deixe o caminho feliz evidente

Use guard clauses para encerrar estados inválidos cedo e evitar níveis desnecessários de indentação.

```ts
const product = await productRepository.findById(productId);

if (!product) {
  throw new ProductNotFoundError(productId);
}

product.rename(name);
await productRepository.save(product);
```

Evite ternários aninhados, cadeias longas de métodos e expressões compactas que economizam linhas, mas aumentam o esforço de leitura.

## Torne regras e estados inválidos explícitos

- Valide dados externos na borda da aplicação.
- Proteja invariantes dentro do domínio.
- Use tipos específicos quando um primitivo não expressar a regra com segurança.
- Não use `any`; prefira um tipo conhecido ou `unknown` com narrowing explícito.
- Não represente ausência, falha e sucesso com o mesmo valor ambíguo.
- Use erros com nomes do domínio e converta-os para HTTP na camada de apresentação.

Números, textos ou prazos com significado devem ter nome. Evite valores mágicos espalhados pelo código.

```ts
const ACCESS_TOKEN_TTL_SECONDS = 900;
```

## Comentários explicam o porquê

O código deve explicar o que faz. Comentários registram contexto que não pode ser expresso apenas por nomes ou estrutura, por exemplo:

- motivo de uma decisão não óbvia;
- limitação de uma integração externa;
- consequência importante de segurança ou desempenho;
- referência para uma ADR ou contrato.

```ts
// Evite: repete a instrução.
// Busca o produto pelo ID.
const product = await productRepository.findById(productId);

// Aceitável: preserva uma razão que poderia ser removida por engano.
// O cursor não é decodificado pelo controller; sua estrutura pertence ao adaptador DynamoDB.
const page = await listProducts.execute(query);
```

Comentários desatualizados são defeitos. TODOs devem indicar uma ação concreta e, quando existir, uma referência rastreável.

## Respeite as fronteiras arquiteturais

- `domain` não conhece NestJS, HTTP, DynamoDB ou JWT.
- `application` descreve casos de uso e portas.
- `infrastructure` implementa integrações e persistência.
- `presentation` valida e traduz o protocolo HTTP.
- O composition root conecta contratos e implementações.

DTO não é entidade, item do DynamoDB não é entidade e exceção HTTP não é erro de domínio. Faça as conversões nas bordas apropriadas.

## Testes também são código de leitura

- O nome do teste descreve comportamento e resultado observável.
- Organize cada teste em preparação, execução e verificação, sem comentários quando a separação visual bastar.
- Teste contratos e regras, não detalhes privados de implementação.
- Um teste deve falhar por um motivo claro.
- Builders e factories de teste devem reduzir ruído sem esconder os dados importantes para o cenário.

```ts
it('rejects a product with a non-positive price', () => {
  expect(() => Product.create({ ...validProduct, price: 0 })).toThrow(
    InvalidProductPriceError,
  );
});
```

## Sinais de que o código precisa ser simplificado

- nomes como `utils`, `helpers`, `common`, `base` ou `generic` sem responsabilidade precisa;
- classe que muda por razões de domínio, HTTP e persistência;
- função que exige comentários para separar suas várias etapas;
- abstração com apenas uma implementação e nenhuma fronteira concreta;
- muitos parâmetros booleanos ou condicionais por tipo;
- mock complexo demais para testar uma regra simples;
- necessidade de navegar por muitos arquivos para entender uma operação pequena.

Esses sinais pedem análise, não uma refatoração automática. A mudança deve deixar a intenção mais evidente e preservar o comportamento coberto pelos testes.

