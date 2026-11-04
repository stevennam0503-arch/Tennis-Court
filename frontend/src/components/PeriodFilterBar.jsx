import React from 'react';
import { Calendar } from 'lucide-react';
import { Button } from './UI';

export default function PeriodFilterBar({
  title = 'Kỳ chọn:',
  periodType,
  setPeriodType,
  selectedDay,
  setSelectedDay,
  currentToday,
  selectedMonth,
  setSelectedMonth,
  selectedQuarter,
  setSelectedQuarter,
  selectedQuarterYear,
  setSelectedQuarterYear,
  selectedYear,
  setSelectedYear,
  currentYear,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  periodLabel
}) {
  return (
    <div className="panel-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Calendar size={18} style={{ color: 'var(--green)' }} />
        <b>{title}</b>
      </div>

      <div className="time-filters" style={{ margin: 0 }}>
        {[
          ['day', 'Theo Ngày'],
          ['month', 'Theo Tháng'],
          ['quarter', 'Theo Quý'],
          ['year', 'Theo Năm'],
          ['custom', 'Khoảng ngày'],
          ['all', 'Toàn bộ']
        ].map(([mode, label]) => (
          <button
            key={mode}
            className={periodType === mode ? 'on' : ''}
            onClick={() => setPeriodType(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
        {periodType === 'day' && (
          <>
            <input
              type="date"
              aria-label="Chọn ngày"
              value={selectedDay}
              onChange={e => e.target.value && setSelectedDay(e.target.value)}
              style={{ width: 170 }}
            />
            <Button className="sm" onClick={() => setSelectedDay(currentToday)}>Hôm nay</Button>
          </>
        )}

        {periodType === 'month' && (
          <input
            type="month"
            aria-label="Chọn tháng"
            value={selectedMonth}
            onChange={e => e.target.value && setSelectedMonth(e.target.value)}
            style={{ width: 170 }}
          />
        )}

        {periodType === 'quarter' && (
          <>
            <select
              aria-label="Chọn quý"
              value={selectedQuarter}
              onChange={e => setSelectedQuarter(e.target.value)}
              style={{ width: 130 }}
            >
              <option value="Q1">Quý 1 (T1-T3)</option>
              <option value="Q2">Quý 2 (T4-T6)</option>
              <option value="Q3">Quý 3 (T7-T9)</option>
              <option value="Q4">Quý 4 (T10-T12)</option>
            </select>
            <select
              aria-label="Chọn năm"
              value={selectedQuarterYear}
              onChange={e => setSelectedQuarterYear(Number(e.target.value))}
              style={{ width: 110 }}
            >
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <option key={y} value={y}>Năm {y}</option>
              ))}
            </select>
          </>
        )}

        {periodType === 'year' && (
          <select
            aria-label="Chọn năm"
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ width: 130 }}
          >
            {[currentYear, currentYear - 1, currentYear - 2].map(y => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
        )}

        {periodType === 'custom' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Từ:</span>
            <input
              type="date"
              aria-label="Từ ngày"
              value={customStart}
              onChange={e => e.target.value && setCustomStart(e.target.value)}
              style={{ width: 140 }}
            />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Đến:</span>
            <input
              type="date"
              aria-label="Đến ngày"
              value={customEnd}
              onChange={e => e.target.value && setCustomEnd(e.target.value)}
              style={{ width: 140 }}
            />
          </div>
        )}

        <span className="chip green" style={{ fontWeight: 600 }}>
          {periodLabel}
        </span>
      </div>
    </div>
  );
}
