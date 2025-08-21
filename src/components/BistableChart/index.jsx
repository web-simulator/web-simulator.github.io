import { memo } from 'react'; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BistableChart = ({ data }) => {
  // Caso não haja dados, exibe mensagem
  if (!data || data.length === 0) {
    return <p>Aguardando simulação...</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 20,
        }}
      >
        {/* Grade de fundo */}
        <CartesianGrid strokeDasharray="3 3" />

        {/* Eixo X */}
        <XAxis
          type="number"
          dataKey="x"
          name="Posição (x)"
          label={{ value: 'Posição (x)', position: 'insideBottom', offset: -10 }}
          domain={[0, 'dataMax']}
        />

        {/* Eixo Y */}
        <YAxis 
          label={{ value: 'v', angle: -90, position: 'insideLeft' }}
          domain={[-0.2, 1.2]} 
        />

        {/* Tooltip ao passar o mouse */}
        <Tooltip 
          formatter={(value, name) => {
            if (typeof value === 'number') {
              return [`${value.toFixed(3)}`, name];
            }
            return [value, name];
          }}
        />

        {/* Legenda no topo */}
        <Legend verticalAlign="top" />

        {/* Linha do potencial v */}
        <Line
          type="monotone"
          data={data}
          dataKey="v"
          stroke="#8884d8"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          name="Potencial v"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

// Evita renderizações desnecessárias
export default memo(BistableChart);
