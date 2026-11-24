# KS Consultores · Avenças e propostas

Aplicação local para calcular avenças de contabilidade e emitir a proposta de prestação de serviços para 2027. Os preços vêm do modelo Excel (folhas Honorários, RU e Nota). Não há serviços externos: a base é um ficheiro SQLite.

## Instalar e correr

```bash
npm install
npm run seed
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

`npm run seed` cria os dados de exemplo se ainda não existirem clientes. `npm run seed:reset` repõe o exemplo. Sem `DATABASE_URL`, a base fica em memória neste processo. Na publicação, os dados ficam na base Postgres da aplicação.

## Exemplo

O cliente semeado é a **2825 - Atividades Hoteleiras, Lda** (situação a 01/05/2026). Na ficha, o ano **2027** traz as linhas do modelo:

- avença mensal de responsabilidade de CC: 150,00 € × 12 = 1.800,00 €
- encerramento de contas: 150,00 €
- reporting trimestral: incluído
- vencimentos: incluído o sócio-gerente (0 funcionários extra)
- opcionais com preço: RCBE 150,00 €, livro de atas 100,00 €, relatório de gestão 150,00 €

Correntes anuais: **1.950,00 €**. Com IVA à taxa normal de 23%: **2.398,50 €**.

Para ver o processamento de vencimentos, na linha respetiva indique os funcionários extra (sem o sócio-gerente). Três funcionários dão 30,00 €/mês. No Relatório Único, o mesmo número de colaboradores escolhe o escalão (1–5 = 80 €, 6–20 = 150 €, 21–50 = 200 €, 51–99 = 350 €, a partir de 100 = 550 €).

Na proposta, use **Editar textos** e depois **Gerar PDF**.
