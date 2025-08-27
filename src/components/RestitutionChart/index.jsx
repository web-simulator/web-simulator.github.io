import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Brush } from 'recharts';

// Define o componente
const RestitutionChart = ({ data, analyticalData }) => {
  return (
    // Gráfico se ajusta automaticamente ao tamanho do pai
    <ResponsiveContainer width="100%" height={400}>
      {/* ComposedChart permite combinar diferentes tipos de gráficos*/}
      <ComposedChart
        margin={{ // Define uma margem interna no gráfico para que os eixos e legendas não fiquem cortados
          top: 20,
          right: 30,
          left: 20,
          bottom: 20,
        }}
      >
        {/* Grade quadriculada no fundo do gráfico */}
        <CartesianGrid strokeDasharray="3 3" />

        {/* Eixo horizontal*/}
        <XAxis
          type="number" // O eixo representa valores numéricos
          dataKey="bcl" // Valores do eixo X estão na chave bcl
          name="DI" // Nome da variável
          unit="ms" // Unidade
          // Título para o eixo
          label={{ value: 'DI', position: 'insideBottom', offset: -10 }}
          domain={[0, 'dataMax']} // Eixo se ajusta a amplitude dos dados
          tickFormatter={(value) => `${value.toFixed(2)}`} // Duas casas decimais
        />
        {/* Eixo vertical*/}
        <YAxis
          type="number"
          dataKey="apd" // Valores do eixo Y estão na chave apd
          name="APD"
          unit="ms"
          label={{ value: 'APD', angle: -90, position: 'insideLeft' }}
        />
        {/* Valores ao passar o mouse pelo gráfico */}
        <Tooltip
          formatter={(value, name) => [`${value.toFixed(2)} ms`, name]} // duas casas decimais
          labelFormatter={(label) => `DI: ${label.toFixed(2)} ms`}
        />
        {/* Legenda para cada curva*/}
        <Legend verticalAlign="top" />

        {/* Barra de navegação para zoom e seleção */}
        <Brush
          dataKey="bcl"
          height={30}
          stroke="#8884d8"
          travellerWidth={10}
        />

        {/* Curva da simulação */}
        <Line
          type="monotone" // O tipo de curva
          data={data} // Os dados do gráfico
          dataKey="apd" // Valores do eixo Y
          stroke="#8884d8" // A cor da linha
          strokeWidth={2} // A espessura da linha
          name="Curva de Restituição (Simulada)" // Legenda.
          dot={{ r: 4 }} // Desenha um ponto para cada dado
          activeDot={{ r: 8 }} // O ponto fica maior ao passar o mouse sobre ele
          isAnimationActive={false} // Desativa a animação ao renderizar 
        />
        
        {/* Somente será executado se tivermos dados para a curva analítica*/}
        {analyticalData && analyticalData.length > 0 && (
          // Curva analítica
          <Line
            type="monotone"
            data={analyticalData} // os dados vem da curva analítica
            dataKey="apd"
            stroke="#82ca9d" // Cor da linha
            strokeWidth={2}
            name="Curva de Restituição (Analítica)"
            dot={false} // Apenas a linha sem pontos
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
};

// Exporta o componente
export default RestitutionChart;