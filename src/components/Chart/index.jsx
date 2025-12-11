import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';

const Chart = ({ data }) => {
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
        
        {/* Curva da voltagem */}
        <Line 
          type="monotone"       
          dataKey="v"           
          stroke="#8884d8"      
          name="Voltagem"
          dot={false}           
          isAnimationActive={false} 
          strokeWidth={2.2}
        />
        
        {/* Curva do Gate */}
        <Line 
          type="monotone" 
          dataKey="h" 
          stroke="#82ca9d" 
          name="Gate h"
          dot={false} 
          isAnimationActive={false} 
          strokeWidth={2.2}
        />

        {/* Curvas específicas do Minimal Model */}
        <Line 
          type="monotone" 
          dataKey="gate_v" 
          stroke="#ff7300" 
          name="Gate v"
          dot={false} 
          isAnimationActive={false} 
          strokeWidth={2.0}
        />
        <Line 
          type="monotone" 
          dataKey="gate_w" 
          stroke="#ff0000" 
          name="Gate w"
          dot={false} 
          isAnimationActive={false} 
          strokeWidth={2.0}
        />
        <Line 
          type="monotone" 
          dataKey="gate_s" 
          stroke="#00bfff" 
          name="Gate s"
          dot={false} 
          isAnimationActive={false} 
          strokeWidth={2.0}
        />

      </LineChart>
    </ResponsiveContainer>
  );
};

export default Chart;