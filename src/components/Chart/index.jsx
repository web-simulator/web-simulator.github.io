import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// A biblioteca Recharts é usada para criar gráficos em React
// Componente Chart que recebe os dados como propriedade
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
        <XAxis dataKey="tempo" />
        
        {/* Eixo Y */}
        <YAxis />
        
        {/* Exibir valores ao passar o mouse*/}
        <Tooltip />
        
        {/* Legenda do gráfico */}
        <Legend />
        
        {/* Curva da voltagem */}
        <Line 
          type="monotone"       // Tipo de curva (monotônica)
          dataKey="v"           // Chave do objeto de dados a ser usada
          stroke="#8884d8"      // Cor da linha
          dot={false}           // Remove os pontos visíveis nos dados
          isAnimationActive={false} // Desativa animação ao renderizar
        />
        
        {/* Curva do Gate */}
        <Line 
          type="monotone" 
          dataKey="h" 
          stroke="#82ca9d" 
          dot={false} 
          isAnimationActive={false} 
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default Chart;
