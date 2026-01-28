import { useMemo } from 'react';
import { t } from 'i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';

// Cores das linhas 
const LINES_CONFIG = {
  v: { stroke: "#8884d8", name: t('chart.potential_unit') },
  h: { stroke: "#82ca9d", name: "Gate h" },
  gate_v: { stroke: "#ff7300", name: "Gate v" },
  gate_w: { stroke: "#ff0000", name: "Gate w" },
  gate_s: { stroke: "#00bfff", name: "Gate s" }
};

const MAX_DISPLAY_POINTS = 3000; // Limite seguro para SVG sem travar

const Chart = ({ data }) => {
  const availableKeys = data && data.length > 0 ? Object.keys(data[0]) : [];

  const displayData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Se a quantidade de dados for menor que o limite, usa os dados originais
    if (data.length <= MAX_DISPLAY_POINTS) return data;

    // Amostragem simples para reduzir o número de pontos
    const factor = Math.ceil(data.length / MAX_DISPLAY_POINTS);
    const sampled = [];
    
    for (let i = 0; i < data.length; i += factor) {
      sampled.push(data[i]);
    }
    
    // Garante que o último ponto seja incluído para fechar o gráfico corretamente
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
        sampled.push(data[data.length - 1]);
    }

    return sampled;
  }, [data]);

  return (
    // Container responsivo para ajustar o gráfico ao tamanho do elemento pai
    <ResponsiveContainer width="100%" height={400}>
      {/* Componente principal do gráfico de linhas */}
      <LineChart
        data={displayData} // Usa os dados otimizados
        margin={{
          top: 5,    
          right: 30, 
          left: 20,  
          bottom: 5,
        }}
      >
        
        {/* Traços no gráfico */}
        <CartesianGrid strokeDasharray="3 3" />
        
        {/* Eixo X */}
        <XAxis 
            dataKey="tempo"
            minTickGap={50} 
            allowDuplicatedCategory={false}
            tickFormatter={(tick) => typeof tick === 'number' ? tick.toFixed(0) : tick}
        />
        
        {/* Eixo Y */}
        <YAxis />
        
        {/* Exibir valores ao passar o mouse*/}
        <Tooltip 
          formatter={(value, name) => {
            if (typeof value === 'number') {
              return [`${value.toFixed(3)}`, name];
            }
            return [value, name];
          }}
          labelFormatter={(label) => `${t('chart.time_ms')}: ${label}`}
        />
        
        {/* Legenda do gráfico */}
        <Legend />

        {/* Barra de navegação para zoom e seleção */}
        <Brush
          dataKey= "tempo"
          height={30}
          stroke="#8884d8"
          travellerWidth={10}
          tickFormatter={(tick) => typeof tick === 'number' ? tick.toFixed(0) : tick}
        />
        
        {/* Renderização das linhas */}
        {Object.keys(LINES_CONFIG).map(key => {
            if (availableKeys.includes(key)) {
                return (
                    <Line 
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={LINES_CONFIG[key].stroke}
                        name={LINES_CONFIG[key].name}
                        dot={false}
                        isAnimationActive={false} // Desativa animação para performance
                        strokeWidth={2}
                        activeDot={{ r: 4 }} // Reduz tamanho do ponto ativo
                    />
                );
            }
            return null;
        })}

      </LineChart>
    </ResponsiveContainer>
  );
};

export default Chart;