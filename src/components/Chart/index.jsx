import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Chart = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="tempo" />
        <YAxis />
        <Tooltip />
        <Legend />
        {/* Desativar a animação para melhorar a performance */}
        <Line type="monotone" dataKey="v" stroke="#8884d8" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="h" stroke="#82ca9d" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default Chart;