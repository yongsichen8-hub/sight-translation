import { useState, useEffect, useCallback } from 'react';
import { getStats, StatsData } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import './AnalyticsPage.css';

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'];
const PIE_COLORS = ['#1677ff', '#52c41a'];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters: { startDate?: string; endDate?: string } = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      const data = await getStats(filters);
      setStats(data);
    } catch {
      setError('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="analytics-error">{error} <button onClick={loadData}>重试</button></div>;
  if (!stats) return null;

  const pieData = [
    { name: '口译', value: stats.interpretationTime },
    { name: '笔译', value: stats.translationTime },
  ].filter(d => d.value > 0);

  return (
    <div className="analytics-page">
      <h2 className="analytics-title">数据分析</h2>

      {/* Date filter */}
      <div className="analytics-filters">
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="analytics-input" />
        <span>至</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="analytics-input" />
      </div>

      {/* Overview cards */}
      <div className="analytics-cards">
        <div className="analytics-card">
          <div className="card-value">{stats.totalTime}</div>
          <div className="card-label">总工时（分钟）</div>
        </div>
        <div className="analytics-card">
          <div className="card-value">{stats.interpretationTime}</div>
          <div className="card-label">口译工时</div>
        </div>
        <div className="analytics-card">
          <div className="card-value">{stats.translationTime}</div>
          <div className="card-label">笔译工时</div>
        </div>
        <div className="analytics-card">
          <div className="card-value">{stats.translatorCount}</div>
          <div className="card-label">译员人数</div>
        </div>
      </div>

      {/* Charts */}
      <div className="analytics-charts">
        {/* By translator bar chart */}
        {stats.byTranslator.length > 0 && (
          <div className="chart-section">
            <h3>按译员分组</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.byTranslator}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="interpretationTime" name="口译" fill="#1677ff" />
                <Bar dataKey="translationTime" name="笔译" fill="#52c41a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* By project bar chart */}
        {stats.byProject.length > 0 && (
          <div className="chart-section">
            <h3>按项目分组</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.byProject}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalTime" name="总工时" fill="#1677ff">
                  {stats.byProject.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pie chart */}
        {pieData.length > 0 && (
          <div className="chart-section">
            <h3>口译/笔译占比</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
