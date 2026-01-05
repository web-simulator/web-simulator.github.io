import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';

// Cores das linhas 
const LINES_CONFIG = {
  v: { stroke: "#8884d8", name: "Voltagem" },
  h: { stroke: "#82ca9d", name: "Gate h" },
  gate_v: { stroke: "#ff7300", name: "Gate v" },
  gate_w: { stroke: "#ff0000", name: "Gate w" },
  gate_s: { stroke: "#00bfff", name: "Gate s" }
};

const Chart = ({ data }) => {
  const availableKeys = data && data.length > 0 ? Object.keys(data[0]) : []; // Linhas disponíveis

  return (
    // Container responsivo para ajustar o gráfico ao tamanho do elemento pai
    <ResponsiveContainer width="100%" height={400}>
      {/* Componente principal do gráfico de linhas */}
      <LineChart
        data={data} // Dados que serão exibidos no gráfico
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
        <XAxis dataKey="tempo" minTickGap={80} />
        
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
        />
        
        {/* Legenda do gráfico */}
        <Legend />

        {/* Barra de navegação para zoom e seleção */}
        <Brush
          dataKey="tempo"
          height={30}
          stroke="#8884d8"
          travellerWidth={10}
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
                        isAnimationActive={false}
                        strokeWidth={2.2}
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