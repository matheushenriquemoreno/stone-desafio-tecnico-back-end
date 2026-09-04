# Princípios de design

## KISS: mantenha simples

KISS orienta a escolher a menor solução que resolva corretamente o problema atual. Código simples deixa decisões visíveis, tem menos caminhos de execução e exige menos contexto para ser entendido.

### Práticas

- Implemente o requisito atual, sem mecanismos para cenários apenas imaginados.
- Prefira fluxo explícito a metaprogramação, heranças profundas ou configuração indireta.
- Use recursos comuns da linguagem antes de criar um mini-framework interno.
- Separe uma responsabilidade quando isso melhora a leitura ou os testes, não apenas para aumentar o número de arquivos.
- Remova código morto e opções que ainda não possuem uso real.

### Evite uma abstração prematura

```ts
// Evite: uma infraestrutura genérica criada antes de existir outro caso real.
abstract class CrudService<TEntity, TCreate, TUpdate> {
  abstract create(input: TCreate): Promise<TEntity>;
  abstract update(id: string, input: TUpdate): Promise<TEntity>;
}
```

```ts
// Prefira: a operação e a linguagem do domínio ficam explícitas.
export class CreateProduct {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: CreateProductInput): Promise<Product> {
    const product = Product.create(input);
    await this.products.save(product);
    return product;
  }
}
```

Uma classe ou interface adicional é bem-vinda quando representa uma fronteira arquitetural, uma regra própria ou uma dependência substituível. KISS não é uma justificativa para misturar HTTP, domínio e persistência no mesmo lugar.

## DRY: não duplique conhecimento

DRY significa manter cada regra de negócio ou decisão em uma fonte de verdade. Dois trechos parecidos não são necessariamente a mesma regra; uni-los à força pode acoplar comportamentos que evoluem por motivos diferentes.

### Aplique DRY quando

- a mesma regra precisa mudar sempre nos mesmos lugares;
- a duplicação representa o mesmo conceito de domínio;
- a extração recebe um nome claro e reduz o esforço de entendimento;
- já existe evidência de reutilização, e não apenas uma possibilidade futura.

### Aceite duplicação temporária quando

- os trechos apenas se parecem, mas pertencem a regras diferentes;
- a abstração exigiria parâmetros booleanos, condicionais por tipo ou nomes genéricos;
- ainda não está claro qual parte realmente permanece estável.

```ts
// Evite: a mesma regra de normalização espalhada por vários casos de uso.
const normalizedEmail = input.email.trim().toLowerCase();
```

```ts
// Prefira: o conceito é dono da própria invariante.
export class Email {
  private constructor(readonly value: string) {}

  static create(rawValue: string): Email {
    const value = rawValue.trim().toLowerCase();

    if (!isValidEmail(value)) {
      throw new InvalidEmailError();
    }

    return new Email(value);
  }
}
```

Não extraia uma função apenas para evitar repetir duas ou três linhas óbvias. Extraia quando puder nomear o conhecimento compartilhado.

## SOLID: responsabilidades e dependências claras

### S — Single Responsibility Principle

Uma unidade deve ter um motivo coeso para mudar.

- Controller traduz HTTP e chama um caso de uso.
- Caso de uso orquestra uma operação da aplicação.
- Entidade ou value object protege invariantes do domínio.
- Repositório traduz entre domínio e persistência.

Se um controller calcula preço, monta comando do DynamoDB e assina JWT, existem responsabilidades misturadas.

### O — Open/Closed Principle

Prefira adicionar uma implementação em uma fronteira existente a alterar regras estáveis com vários condicionais. Só crie a fronteira quando houver uma variação real.

Um `PasswordHasher` permite trocar ou testar o algoritmo sem alterar `RegisterUser`. Não é necessário criar uma estratégia genérica para uma operação que possui uma única forma concreta e não cruza uma fronteira arquitetural.

### L — Liskov Substitution Principle

Uma implementação deve cumprir integralmente o contrato da abstração que implementa.

Se `ProductRepository.findById` promete retornar `null` quando o produto não existe, uma implementação DynamoDB não pode lançar um erro de infraestrutura nesse caso enquanto um fake retorna `null`. Ambas precisam conservar a mesma semântica observável.

### I — Interface Segregation Principle

Uma dependência deve expor apenas o que seu consumidor precisa.

```ts
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
}
```

Não force um caso de uso a depender de uma interface genérica com métodos como `count`, `bulkDelete` ou `transaction` que ele não utiliza. Também não fragmente cada método em uma interface diferente sem ganho concreto de coesão.

### D — Dependency Inversion Principle

Regras de domínio e aplicação dependem de contratos próprios, não de NestJS, AWS SDK, banco de dados ou bibliotecas externas.

```ts
export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}
}
```

O módulo NestJS conecta esses contratos às implementações concretas. Essa inversão mantém o caso de uso testável sem iniciar framework ou banco.

## Como equilibrar os princípios

- KISS impede que DRY produza uma abstração genérica demais.
- DRY impede que a simplicidade local espalhe uma mesma regra pelo sistema.
- SOLID define fronteiras onde já existem responsabilidades e dependências reais.
- A linguagem do domínio decide os nomes e torna a arquitetura legível.

Quando uma solução precisa de uma longa explicação para parecer adequada, simplifique-a antes de adicionar documentação para justificá-la.
