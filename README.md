# Grafico-API

API para gerar gráficos de Assistências e Publicadores de 1998 a 2024.

## Como Usar

Envie uma requisição GET para o endpoint `/api/grafico` com os parâmetros `assistencias` e `publicadores` separados por vírgula.

**Exemplo de URL:**
https://seu-servico.onrender.com/api/grafico?assistencias=80,85,90,95,100,105,110,115,120,125,130,135,140,145,150,155,160,165,170,175,180,185,190,195,200,205,210&publicadores=15,18,20,22,25,28,30,32,35,38,40,42,45,47,50,52,55,57,60,62,65,68,70,72,75,78,80

## Tecnologias Utilizadas

- Node.js
- Express.js
- Chart.js
- chartjs-node-canvas