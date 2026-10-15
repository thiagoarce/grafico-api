# Grafico-API

API usada pelo **Mapa de Propriedades** para gerar, em PNG, os gráficos de assistência das congregações exibidos nos popups do Google Earth.

Produção:

```
https://grafico-api.onrender.com/api/grafico
```

O serviço roda no Render e é publicado a partir deste repositório.

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

Quando recebe o payload novo, a API pode exibir:

- assistência anual;
- assistência mensal recente;
- média móvel de 6 meses;
- tendência histórica;
- tendência recente;
- projeção P50 do modelo hierárquico;
- projeção P70 do modelo hierárquico;
- publicadores anuais e mensais, opcionalmente;
- conclusão do modelo hierárquico;
- inclinação dos últimos 5 anos;
- ano-base e versão do modelo.

### Padrão visual

Por padrão ficam ativos:

- assistência anual;
- assistência mensal;
- média móvel de 6 meses;
- tendência histórica;
- tendência recente;
- projeção P50.

Por padrão ficam desativados:

- projeção P70;
- publicadores.

A janela mensal padrão é de **36 meses**.

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
| `anual` | 1 | Histórico anual |
| `mensal` | 1 | Histórico mensal |
| `publicadores` | 0 | Séries de publicadores |
| `media_movel` | 1 | Média móvel de 6 meses |
| `tend_hist` | 1 | Tendência histórica |
| `tend_rec` | 1 | Tendência recente |
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
  "version": "2.0.0"
}
```

## Tecnologias

- Node.js
- Express
- Chart.js
- chartjs-node-canvas
- Render

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
