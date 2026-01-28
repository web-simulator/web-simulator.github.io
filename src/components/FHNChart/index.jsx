import { Line } from 'react-chartjs-2';
import { t } from 'i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { memo } from 'react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const FHNChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <p>{t('common.simulating')}</p>;
  }

  const chartData = {
    labels: data.map(d => d.x.toFixed(2)),
    datasets: [
      {
        label: t('chart.potential_unit'),
        data: data.map(d => d.v),
        borderColor: 'rgb(136, 132, 216)',
        backgroundColor: 'rgba(136, 132, 216, 0.5)',
        pointRadius: 0,
        tension: 0.1,
      },
      {
        label: 'w',
        data: data.map(d => d.w),
        borderColor: 'rgb(130, 202, 157)',
        backgroundColor: 'rgba(130, 202, 157, 0.5)',
        pointRadius: 0,
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    animation: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: t('fhnChart.title'),
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: t('chart.position_unit'),
        },
        type: 'category',
        ticks: {
          autoSkip: true,
          maxTicksLimit: 10,
        },
      },
      y: {
        title: {
          display: true,
          text: t('fhnChart.value'),
        },
        min: -0.8,
        max: 1.2,
      },
    },
  };

  return <Line options={options} data={chartData} />;
};

export default memo(FHNChart);