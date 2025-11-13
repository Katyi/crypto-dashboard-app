import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Activity,
  Loader2,
  BarChart3,
  Clock,
  Zap,
} from 'lucide-react';

// ----------------------------------------------------------------
// ТИПЫ ДАННЫХ
// ----------------------------------------------------------------

/**
 * Интерфейс данных, получаемых из бэкенда NestJS.
 */
interface MetricData {
  id: number;
  symbol: string;
  source: string;
  priceUSD: number;
  marketCapUSD: number;
  volume24hUSD: number;
  deaiScore: number;
  createdAt: string;
}

// ----------------------------------------------------------------
// ФОРМАТИРОВАНИЕ
// ----------------------------------------------------------------

// Функция для форматирования больших чисел в K, M, B (русский формат)
const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';

  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;

  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Функция для форматирования временной метки для оси X
const formatTime = (timestamp: string): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  // Формат времени ЧЧ:ММ (22:30)
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Компонент Tooltip для Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    // Исходная метка времени
    const rawDate = new Date(label);
    // Форматируем для отображения в Tooltip: Дата и время
    const formattedDate = rawDate.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    });
    const formattedTime = rawDate.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div className="p-3 bg-white border border-gray-300 rounded-lg shadow-xl text-sm">
        <p className="font-bold text-gray-700">
          {formattedDate} - {formattedTime}
        </p>
        {payload.map((p: any, index: number) => (
          <p key={index} style={{ color: p.color }} className="mt-1">
            {p.name}:
            <span className="font-semibold ml-1">
              {p.name === 'Deai Score'
                ? p.value.toFixed(2)
                : p.name === 'Цена USD'
                ? p.value.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })
                : formatCurrency(p.value)}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Компонент-карточка для метрик
const MetricCard = ({
  title,
  value,
  icon: Icon,
  unit,
  colorClass,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  unit?: string;
  colorClass: string;
}) => (
  <div className="bg-white p-5 rounded-xl shadow-lg border border-gray-100 transition duration-300 hover:shadow-xl">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <Icon className={`w-5 h-5 ${colorClass}`} />
    </div>
    <p className="mt-1 text-3xl font-bold text-gray-900">
      {value}
      {unit && (
        <span className="text-base font-normal text-gray-500 ml-1">{unit}</span>
      )}
    </p>
  </div>
);

// ----------------------------------------------------------------
// ГЛАВНЫЙ КОМПОНЕНТ ДАШБОРДА
// ----------------------------------------------------------------

const Dashboard: React.FC = () => {
  const [data, setData] = useState<MetricData[]>([]);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // NOTE: Порт 3000 используется по умолчанию в NestJS.
  // Убедитесь, что ваш NestJS сервер запущен и настроен CORS!
  const API_URL = 'http://localhost:3000/metrics';

  // ----------------------------------------------------------------
  // ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ
  // ----------------------------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Запрос к вашему NestJS API
        const response = await fetch(`${API_URL}?limit=${limit}`);

        if (!response.ok) {
          throw new Error(
            `Ошибка HTTP: ${response.status} ${response.statusText}`
          );
        }

        const result: MetricData[] = await response.json();

        if (result.length === 0) {
          setError(
            'Данные не найдены. Убедитесь, что Cron-задача выполнилась хотя бы раз.'
          );
        }

        setData(result);
      } catch (err) {
        console.error('Ошибка при загрузке данных:', err);
        // Обработка ошибки "Failed to fetch"
        if (
          (err instanceof TypeError &&
            (err as any).message.includes('fetch failed')) ||
          (err as any).message.includes('Failed to fetch')
        ) {
          setError(
            'Не удалось подключиться к NestJS API. Убедитесь, что сервер запущен на http://localhost:3000 и включен CORS.'
          );
        } else {
          setError(
            `Не удалось загрузить данные: ${
              err instanceof Error ? err.message : 'Неизвестная ошибка'
            }`
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [limit]); // Перезапускаем при изменении лимита

  // ----------------------------------------------------------------
  // ВЫЧИСЛЕНИЕ ОСНОВНЫХ МЕТРИК И ФОРМАТИРОВАНИЕ ДЛЯ КАРТОЧЕК
  // ----------------------------------------------------------------
  const latestMetric = useMemo(() => {
    // Берем последнюю запись для карточек
    return data.length > 0 ? data[data.length - 1] : null;
  }, [data]);

  // Форматирование данных для графиков (добавление читаемых имен полей)
  const chartData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      'Deai Score': item.deaiScore,
      'Цена USD': item.priceUSD,
      'Рыночная капитализация': item.marketCapUSD,
    }));
  }, [data]);

  // Обработчик изменения лимита
  const handleLimitChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(event.target.value));
  };

  // ----------------------------------------------------------------
  // РЕНДЕРИНГ ЭКРАНОВ СОСТОЯНИЙ
  // ----------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="ml-3 text-lg text-gray-600">Загрузка данных...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 h-96 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg shadow-md max-w-lg">
          <h2 className="text-xl font-bold mb-2">Ошибка загрузки данных</h2>
          <p className="mb-4">{error}</p>
          <p className="mt-3 text-sm">
            Подсказка: Убедитесь, что ваш бэкенд NestJS запущен на
            `http://localhost:3000` и включен CORS.
          </p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------
  // ОСНОВНОЙ РЕНДЕРИНГ ДАШБОРДА
  // ----------------------------------------------------------------
  return (
    <div className="p-4 sm:p-8">
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-1">
            <BarChart3 className="inline-block w-8 h-8 mr-2 text-indigo-600" />
            ETH Deai Score Dashboard
          </h1>
          <p className="text-gray-500 text-lg">
            Метрики ${latestMetric?.symbol.toUpperCase()} за последние{' '}
            {data.length} записей.
          </p>
        </div>

        {/* Селектор лимита */}
        <div className="mt-4 sm:mt-0 flex items-center">
          <label
            htmlFor="limit-select"
            className="text-sm font-medium text-gray-700 mr-3 whitespace-nowrap"
          >
            Записей:
          </label>
          <select
            id="limit-select"
            value={limit}
            onChange={handleLimitChange}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
          >
            <option value={10}>Последние 10</option>
            <option value={20}>Последние 20</option>
            <option value={50}>Последние 50</option>
            <option value={100}>Последние 100</option>
          </select>
        </div>
      </header>

      {/* КАРТОЧКИ С ОСНОВНЫМИ ПОКАЗАТЕЛЯМИ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <MetricCard
          title="Последний Deai Score"
          value={latestMetric ? latestMetric.deaiScore.toFixed(2) : 'N/A'}
          icon={Zap}
          colorClass="text-indigo-600"
        />
        <MetricCard
          title="Текущая цена"
          value={latestMetric ? formatCurrency(latestMetric.priceUSD) : 'N/A'}
          unit="USD"
          icon={DollarSign}
          colorClass="text-green-600"
        />
        <MetricCard
          title="Рыночная капитализация"
          value={
            latestMetric ? formatCurrency(latestMetric.marketCapUSD) : 'N/A'
          }
          unit="USD"
          icon={Activity}
          colorClass="text-yellow-600"
        />
        <MetricCard
          title="Объем 24ч"
          value={
            latestMetric ? formatCurrency(latestMetric.volume24hUSD) : 'N/A'
          }
          unit="USD"
          icon={TrendingUp}
          colorClass="text-red-600"
        />
      </div>

      {/* ГРАФИКИ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ГРАФИК 1: Deai Score */}
        <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Исторический Deai Score
          </h2>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorDeai" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="createdAt" tickFormatter={formatTime} />
                <YAxis domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Deai Score"
                  stroke="#4F46E5"
                  fillOpacity={1}
                  fill="url(#colorDeai)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ГРАФИК 2: Цена USD и Рыночная капитализация */}
        <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Цена USD и Рыночная капитализация
          </h2>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="createdAt" tickFormatter={formatTime} />
                {/* Две оси Y для разных метрик */}
                <YAxis
                  yAxisId="left"
                  tickFormatter={formatCurrency}
                  domain={['auto', 'auto']}
                  stroke="#10B981"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={formatCurrency}
                  domain={['auto', 'auto']}
                  stroke="#F59E0B"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Цена USD"
                  stroke="#10B981"
                  activeDot={{ r: 8 }}
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="Рыночная капитализация"
                  stroke="#F59E0B"
                  activeDot={{ r: 8 }}
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <footer className="mt-10 pt-4 text-center text-sm text-gray-500 border-t border-gray-200">
        <Clock className="inline-block w-4 h-4 mr-1 mb-0.5" />
        Данные предоставлены CoinGecko. Обновление происходит дважды в день.
      </footer>
    </div>
  );
};

export default Dashboard;
