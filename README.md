# Grafico-API

API usada pelo **Mapa de Propriedades** para gerar, em PNG, os gráficos de assistência das congregações exibidos nos popups do Google Earth.

Endpoint de exemplo:\n\n```\nhttps://seu-servico.example/api/grafico\n```\n\nO serviço pode ser publicado em qualquer plataforma compatível com Node.js.

## Endpoint

```http
GET /api/grafico
```

O endpoint é **retrocompatível**:

- payload antigo → gera o gráfico legado de 1998 a 2024;
- payload novo → gera o gráfico completo com histórico anual, histórico mensal, tendências e projeções do modelo hierárquico.

A detecção é automática. O endpoint considera o payload como novo quando recebe pelo menos um destes parâmetros:

- `anos_anuais`
- `meses`
- `anos_projecao`
- `classe_tendencia`

## Gráfico atual

O payload novo suporta três modos de visualização por meio do parâmetro `modo`:

- `geral` — padrão. Mostra apenas o histórico anual e a projeção central (P50), com leitura executiva.
- `recente` — mostra o movimento recente por média móvel e a projeção dos próximos anos.
- `detalhado` — mostra a visão técnica completa, incluindo dados mensais, tendências e projeções.

O gráfico também destaca visualmente o ponto **ATUAL**, separando passado realizado de futuro projetado.

### Resumo executivo

No topo do gráfico aparecem:

- ritmo de longo prazo, em pessoas por ano;
- ritmo recente, em pessoas por ano;
- classificação do modelo hierárquico;
- ano-base do modelo, quando disponível.

### Padrões por modo

**geral**
- histórico anual: ligado;
- projeção P50: ligada;
- demais séries: desligadas.

**recente**
- média móvel de 6 meses: ligada;
- projeção P50: ligada;
- demais séries: desligadas.

**detalhado**
- histórico anual: ligado;
- dados mensais: ligados;
- média móvel: ligada;
- tendência histórica: ligada;
- tendência recente: ligada;
- P50: ligada;
- P70 e publicadores: desligados.

A janela mensal padrão continua sendo de **36 meses**.

## Parâmetros do payload novo

### Histórico anual

| Parâmetro | Descrição |
|---|---|
| `anos_anuais` | Anos separados por vírgula |
| `assistencias_anuais` | Assistência correspondente a cada ano |
| `publicadores_anuais` | Publicadores correspondentes a cada ano |

Exemplo:

```
anos_anuais=1998,1999,2000
assistencias_anuais=80,84,91
publicadores_anuais=62,65,70
```

## Histórico mensal

| Parâmetro | Descrição |
|---|---|
| `meses` | Meses no formato `AAAA-MM`, separados por vírgula |
| `assistencias_mensais` | Assistência correspondente a cada mês |
| `publicadores_mensais` | Publicadores correspondentes a cada mês |
| `janela_meses` | Quantos meses recentes mostrar. Padrão: 36 |

Exemplo:

```
meses=2026-03,2026-04,2026-05
assistencias_mensais=121,121,112
publicadores_mensais=135,136,134
```

## Modelo hierárquico

| Parâmetro | Descrição |
|---|---|
| `ano_base` | Ano-base do modelo |
| `assistencia_base` | Assistência usada como base da projeção |
| `classe_tamanho` | Classe de tamanho da congregação |
| `inclinacao_5_anos` | Inclinação observada nos últimos 5 anos |
| `classe_tendencia` | Conclusão do modelo: queda, estável, crescimento etc. |
| `versao_modelo` | Versão do modelo hierárquico |
| `anos_projecao` | Anos projetados |
| `p50` | Projeção central |
| `p70` | Projeção de planejamento |
| `limite_inferior` | Limite inferior calculado pelo modelo |
| `limite_superior` | Limite superior calculado pelo modelo |

Os limites inferior e superior já podem ser enviados pelo Power Query, embora a versão atual do gráfico ainda não desenhe a faixa de incerteza.

## Controles de exibição

Os parâmetros abaixo controlam quais séries aparecem no PNG.

Valores aceitos como verdadeiro incluem `1`, `true`, `sim`, `yes` e `on`.  
Valores aceitos como falso incluem `0`, `false`, `nao`, `não`, `no` e `off`.

| Parâmetro | Padrão | Função |
|---|---:|---|
| Parâmetro | Padrão | Função |
|---|---:|---|
| `modo` | geral | `geral`, `recente` ou `detalhado` |
| `anual` | depende do modo | Histórico anual |
| `mensal` | depende do modo | Dados mensais brutos |
| `publicadores` | 0 | Séries de publicadores |
| `media_movel` | depende do modo | Média móvel de 6 meses |
| `tend_hist` | depende do modo | Tendência histórica |
| `tend_rec` | depende do modo | Tendência recente |
| `p50_visivel` | 1 | Projeção P50 |
| `p70_visivel` | 0 | Projeção P70 |

Esses parâmetros foram pensados para os controles do popup do Google Earth: ao marcar ou desmarcar uma opção, o JavaScript do popup apenas solicita outro PNG ao mesmo endpoint.

## Nome da congregação

O título do gráfico usa:

```
congregacao=<nome>
```

Também é aceito `nome_congregacao`.

## Tendências

### Tendência histórica

É calculada por regressão linear sobre os pontos anuais válidos disponíveis.

### Tendência recente

É calculada sobre a média móvel do histórico mensal recente. A API usa até os últimos 36 pontos válidos da média móvel dentro da janela mensal enviada.

As duas linhas são descritivas e independentes da classificação do modelo hierárquico.

## Integração com o Mapa de Propriedades

A planilha prepara os dados no Power Query com esta cadeia:

```
MP Projeção - S-10.xlsx
        ↓
Grafico_Anual_Base

Attendance SY xxxx-x.xlsx
        ↓
Historico_Assistencia_Mensal
        ↓
Grafico_Mensal_Base

MP Projeção - Modelo Hierárquico.xlsx
        ↓
Modelo_Hierarquico_Grafico

              ↓
Grafico_Congregacoes_V2
              ↓
Congregações
              ↓
Dados Assistência
              ↓
VBA / popup do Google Earth
              ↓
/api/grafico
```

O VBA continua usando o mesmo endpoint e a mesma coluna `Dados Assistência`. A mudança do payload acontece no Power Query.

## Compatibilidade com o payload antigo

O formato antigo continua aceito:

```
assistencias=...
&publicadores=...
&congregacao=...
```

Nesse modo, a API espera 27 valores para assistência e 27 para publicadores, correspondentes aos anos de 1998 a 2024.

Esse modo existe apenas para retrocompatibilidade durante a transição do mapa para o payload novo.

## Health check

```http
GET /health
```

Resposta esperada:

```json
{
  "ok": true,
  "service": "grafico-api",
  "version": "2.1.0"
}
```

## Tecnologias

- Node.js
- Express
- Chart.js
- chartjs-node-canvas
- Plataforma de hospedagem Node.js

## Execução local

Instale as dependências:

```bash
npm install
```

Execute:

```bash
npm start
```

Por padrão o serviço usa a porta definida em `PORT` ou `3000`.

Exemplo local:

```
http://localhost:3000/api/grafico
```
