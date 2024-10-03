const express = require('express');
const cors = require('cors');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const app = express();
const port = process.env.PORT || 3000;

// Habilita CORS para permitir que o Google Earth acesse a API
app.use(cors());

// Configurações do Chart.js
const width = 1200; // Largura da imagem
const height = 600; // Altura da imagem
const chartCallback = (ChartJS) => {
    // Configurações adicionais do Chart.js podem ser feitas aqui
};
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, chartCallback });

// Middleware para lidar com erros de forma global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Algo deu errado!');
});

// Endpoint para gerar o gráfico
app.get('/api/grafico', async (req, res) => {
    try {
        const { assistencias, publicadores, congregacao } = req.query;

        // Valida os parâmetros
        if (!assistencias || !publicadores || !congregacao) {
            return res.status(400).send('Parâmetros "assistencias", "publicadores" e "congregacao" são necessários.');
        }

        // Converte os parâmetros para arrays
        const assistenciasArray = assistencias.split(',').map(Number);
        const publicadoresArray = publicadores.split(',').map(Number);

        // Define os anos de 1998 a 2024
        const anos = [];
        for (let ano = 1998; ano <= 2024; ano++) {
            anos.push(ano);
        }

        // Valida o comprimento dos dados
        if (assistenciasArray.length !== anos.length || publicadoresArray.length !== anos.length) {
            return res.status(400).send('O número de valores de assistências e publicadores deve corresponder aos anos de 1998 a 2024.');
        }

        // Sanitiza o nome da congregação para evitar injeções de código
        const nomeCongregacao = congregacao.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Configuração do gráfico
        const configuration = {
            type: 'line',
            data: {
                labels: anos,
                datasets: [
                    {
                        label: 'Número de Assistências',
                        data: assistenciasArray,
                        borderColor: 'rgba(54, 162, 235, 1)', // Azul
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        fill: false,
                        tension: 0.1,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    },
                    {
                        label: 'Número de Publicadores',
                        data: publicadoresArray,
                        borderColor: 'rgba(255, 99, 132, 1)', // Vermelho
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        fill: false,
                        tension: 0.1,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }
                ]
            },
            options: {
                responsive: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${nomeCongregacao} (1998-2024)`,
                        font: {
                            size: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    },
                    legend: {
                        display: true,
                        position: 'top',
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Quantidade'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Ano'
                        }
                    }
                }
            },
        };

        // Renderiza o gráfico para uma imagem PNG
        const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);

        // Define o tipo de conteúdo como imagem PNG
        res.set('Content-Type', 'image/png');
        res.send(imageBuffer);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao gerar o gráfico.');
    }
});

// Inicia o servidor
app.listen(port, () => {
    console.log(`API rodando em http://localhost:${port}`);
});
