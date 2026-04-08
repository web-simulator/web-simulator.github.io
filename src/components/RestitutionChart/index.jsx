import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Brush } from 'recharts';
import { t } from 'i18next';
import { useTranslation } from 'react-i18next';

// Componente atualizado para receber rótulos, chaves, unidades e nome da linha dinamicamente
const RestitutionChart = ({ 
  data, 
  analyticalData,
  xDataKey = "bcl",
  yDataKey = "apd",
  xLabel = "DI",
  yLabel = "APD",
  xUnit = "ms",
  yUnit = "ms",
  lineName
}) => {
  const { t } = useTranslation(); 
  
  const defaultLineName = t("chart.simulated_restitution") || "Simulação";

  return (
    // Gráfico se ajusta automaticamente ao tamanho do pai
    <ResponsiveContainer width="100%" height={400}>
      {/* ComposedChart permite combinar diferentes tipos de gráficos*/}
      <ComposedChart
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 20,
        }}
      >
        {/* Grade quadriculada no fundo do gráfico */}
        <CartesianGrid strokeDasharray="3 3" />

        {/* Eixo horizontal dinâmico */}
        <XAxis
          type="number"
          dataKey={xDataKey}
          name={xLabel}
          unit={xUnit}
          label={{ value: xLabel, position: 'insideBottom', offset: -10 }}
          domain={[0, 'dataMax']}
          tickFormatter={(value) => `${value.toFixed(2)}`}
        />
        
        {/* Eixo vertical dinâmico */}
        <YAxis
          type="number"
          dataKey={yDataKey}
          name={yLabel}
          unit={yUnit}
          label={{ value: yLabel, angle: -90, position: 'insideLeft' }}
        />
        
        {/* Tooltip dinâmico */}
        <Tooltip
          formatter={(value, name) => [`${value.toFixed(4)} ${yUnit}`, name]}
          labelFormatter={(label) => `${xLabel}: ${Number(label).toFixed(2)} ${xUnit}`}
        />
        
        <Legend verticalAlign="top" />

        {/* Barra de navegação para zoom e seleção */}
        <Brush
          dataKey={xDataKey}
          height={30}
          stroke="#8884d8"
          travellerWidth={10}
        />

        {/* Curva simulada */}
        <Line
          type="monotone"
          data={data}
          dataKey={yDataKey}
          stroke="#8884d8"
          strokeWidth={2}
          name={lineName || defaultLineName}
          dot={{ r: 4 }}
          activeDot={{ r: 8 }}
          isAnimationActive={false}
        />
        
        {/* Somente será executado se tivermos dados para a curva analítica*/}
        {analyticalData && analyticalData.length > 0 && (
          // Curva analítica
          <Line
            type="monotone"
            data={analyticalData}
            dataKey={yDataKey}
            stroke="#82ca9d"
            strokeWidth={2}
            name={t("chart.theoretical_restitution") || "Teórica"}
            dot={false}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
};

// Exporta o componente
export default RestitutionChart;