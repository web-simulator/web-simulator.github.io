import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const RestitutionChart = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={data}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 20,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          type="number" 
          dataKey="di" 
          name="DI" 
          unit="ms"
          label={{ value: 'Intervalo Diastólico', position: 'insideBottom', offset: -10 }}
          domain={['dataMin', 'dataMax']}
        />
        <YAxis 
          type="number"
          dataKey="apd" 
          name="APD90" 
          unit="ms" 
          label={{ value: 'APD90', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip 
          formatter={(value, name) => [`${value.toFixed(2)} ms`, name]}
          labelFormatter={(label) => `DI: ${label.toFixed(2)} ms`}
        />
        <Legend verticalAlign="top" />
        <Line 
          type="monotone" 
          dataKey="apd" 
          stroke="#8884d8" 
          strokeWidth={2}
          name="Curva de Restituição"
          dot={{ r: 4 }}
          activeDot={{ r: 8 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default RestitutionChart;