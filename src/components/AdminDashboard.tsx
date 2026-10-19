import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  Database,
  Droplet,
  Flame,
  LogOut,
  Maximize2,
  PieChart,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Table,
  Users,
  Wind,
  X,
} from 'lucide-react';
import {
  DashboardData,
  DashboardFilters,
  DashboardApiError,
  CountItem,
  fetchAdminSessionStatus,
  fetchDashboardData,
  loginAdmin,
  logoutAdmin,
} from '../utils/dashboardApi';

type TabKey = 'demographics' | 'surface' | 'formulas' | 'confirmations' | 'table';
type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

const ageOptions = [
  { value: 'ALL', label: 'Todas las edades' },
  { value: '0-1', label: '0 - 1 año' },
  { value: '1-3', label: '1 - 3 años' },
  { value: '3-6', label: '3 - 6 años' },
  { value: '6-9', label: '6 - 9 años' },
  { value: '10+', label: '10+ años' },
];

const severityOptions = [
  { value: 'ALL', label: 'Todas las severidades' },
  { value: 'Leve', label: 'Leve' },
  { value: 'Moderado', label: 'Moderado' },
  { value: 'Grave', label: 'Grave' },
  { value: 'Crítico', label: 'Crítico / Muy grave' },
];

const formulaOptions = [
  { value: 'ALL', label: 'Parkland & Galveston' },
  { value: 'parkland', label: 'Parkland' },
  { value: 'galveston', label: 'Galveston' },
];

function displayFormula(formula: string): string {
  return formula === 'galveston' ? 'Galveston' : 'Parkland';
}

function yesNo(value: boolean | null): string {
  if (value === true) return 'Sí';
  if (value === false) return 'No';
  return 'Sin dato';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function integer(value: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value);
}

function KpiCard({
  label,
  value,
  subtext,
  tone,
  icon,
}: {
  label: string;
  value: string;
  subtext: string;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="mb-2 flex items-center justify-between text-slate-500">
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        <div className={`rounded-xl p-2 ${tone}`}>{icon}</div>
      </div>
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
      <p className="mt-1 text-xs text-slate-400">{subtext}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const expandedContent = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<any>, { size: 'large' })
    : children;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              {icon}
              {title}
            </h3>
            {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label={`Expandir ${title}`}
            title="Ver en grande"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-6"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-3xl sm:rounded-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
                  {icon}
                  {title}
                </h3>
                {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {expandedContent}
          </div>
        </div>
      )}
    </>
  );
}

const chartColors = [
  '#e11d48',
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
];

function chartItems(items: CountItem[]): CountItem[] {
  return items.filter((item) => item.count > 0);
}

function MultiAnswerPieChart({
  items,
  emptyLabel = 'Sin datos para mostrar',
  size = 'normal',
}: {
  items: CountItem[];
  emptyLabel?: string;
  size?: 'normal' | 'large';
}) {
  const visibleItems = chartItems(items);
  const total = visibleItems.reduce((sum, item) => sum + item.count, 0);

  if (visibleItems.length === 0 || total === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  let accumulated = 0;
  const segments = visibleItems.map((item, index) => {
    const start = (accumulated / total) * 100;
    accumulated += item.count;
    const end = (accumulated / total) * 100;
    return `${chartColors[index % chartColors.length]} ${start}% ${end}%`;
  });
  const isLarge = size === 'large';

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className={`shrink-0 rounded-full shadow-inner ring-1 ring-slate-200 ${isLarge ? 'h-64 w-64' : 'h-36 w-36'}`}
        style={{ background: `conic-gradient(${segments.join(', ')})` }}
        aria-label={`Gráfico circular con ${visibleItems.length} categorías`}
      />
      <div className="w-full space-y-2">
        {(isLarge ? visibleItems : visibleItems.slice(0, 8)).map((item, index) => {
          const itemPercent = Math.round((item.count / total) * 1000) / 10;
          return (
            <div key={item.label} className={`flex items-start justify-between gap-3 ${isLarge ? 'text-sm' : 'text-xs'}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: chartColors[index % chartColors.length] }}
                />
                <span className="wrap-break-word font-medium text-slate-700">{item.label}</span>
              </div>
              <span className="shrink-0 whitespace-nowrap font-bold text-slate-900">
                {item.count} ({itemPercent.toFixed(1)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TwoAnswerBarChart({
  items,
  emptyLabel = 'Sin datos para mostrar',
  size = 'normal',
}: {
  items: CountItem[];
  emptyLabel?: string;
  size?: 'normal' | 'large';
}) {
  const visibleItems = chartItems(items);
  const total = visibleItems.reduce((sum, item) => sum + item.count, 0);
  const max = Math.max(0, ...visibleItems.map((item) => item.count));
  const isLarge = size === 'large';

  if (visibleItems.length === 0 || total === 0 || max === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-4">
      {visibleItems.slice(0, 2).map((item, index) => {
        const itemPercent = Math.round((item.count / total) * 1000) / 10;
        return (
          <div key={item.label}>
            <div className={`mb-1 flex items-center justify-between gap-3 ${isLarge ? 'text-sm' : 'text-xs'}`}>
              <span className="font-medium text-slate-700">{item.label}</span>
              <span className="font-bold text-slate-900">
                {item.count} ({itemPercent.toFixed(1)}%)
              </span>
            </div>
            <div className={`overflow-hidden rounded-lg bg-slate-100 ${isLarge ? 'h-10' : 'h-8'}`}>
              <div
                className={`flex items-center rounded-lg px-3 font-bold text-white ${isLarge ? 'h-10 text-sm' : 'h-8 text-xs'}`}
                style={{
                  width: `${Math.max((item.count / max) * 100, 8)}%`,
                  backgroundColor: chartColors[index % chartColors.length],
                }}
              >
                {itemPercent.toFixed(1)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgeGenderChart({
  ageGroups,
  gender,
  size = 'normal',
}: {
  ageGroups: CountItem[];
  gender: CountItem[];
  size?: 'normal' | 'large';
}) {
  const isLarge = size === 'large';
  return (
    <div className={`grid grid-cols-1 gap-5 ${isLarge ? 'lg:grid-cols-2' : 'sm:grid-cols-2'}`}>
      <MultiAnswerPieChart items={ageGroups} size={size} />
      <TwoAnswerBarChart items={gender} size={size} />
    </div>
  );
}

function FluidAverages({ data }: { data: DashboardData }) {
  if (data.breakdowns.fluidAveragesBySeverity.length === 0) {
    return <p className="text-sm text-slate-500">Sin datos de fluidos para mostrar.</p>;
  }

  return (
    <div className="space-y-4">
      {data.breakdowns.fluidAveragesBySeverity.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-700">{item.label}</span>
            <span className="text-slate-500">{item.count} casos</span>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            <span className="rounded-lg bg-white px-3 py-2 font-semibold text-blue-700">
              24h: {integer(item.totalIn24h)} mL
            </span>
            <span className="rounded-lg bg-white px-3 py-2 font-semibold text-amber-700">
              8h: {integer(item.first8hMl)} mL
            </span>
            <span className="rounded-lg bg-white px-3 py-2 font-semibold text-emerald-700">
              16h: {integer(item.remaining16hMl)} mL
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function signedPp(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)} pp`;
}

function deltaTone(value: number): string {
  if (value === 0) return 'text-slate-500';
  return value > 0 ? 'text-rose-600' : 'text-emerald-600';
}

function ConfirmationDeltaMetrics({ data }: { data: DashboardData }) {
  const confirmation = data.summary.confirmation;
  if (confirmation.confirmedCount === 0) {
    return <p className="text-sm text-slate-500">Sin casos confirmados por el hospital para calcular desvíos.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Casos confirmados</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{integer(confirmation.confirmedCount)}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Delta promedio (confirmado − estimado)</p>
          <p className={`mt-1 text-xl font-bold ${deltaTone(confirmation.avgDeltaTotal)}`}>
            {signedPp(confirmation.avgDeltaTotal)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Desvío absoluto promedio</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{confirmation.meanAbsoluteDeviation.toFixed(2)} pp</p>
        </div>
      </div>
      <div className="space-y-2 md:hidden">
        {confirmation.byHospital.map((item) => (
          <div key={item.hospital} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700">{item.hospital}</span>
              <span className="text-slate-500">{integer(item.confirmedCount)} casos</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <span className={`rounded-lg bg-slate-50 px-3 py-2 font-semibold ${deltaTone(item.avgDeltaTotal)}`}>
                Delta: {signedPp(item.avgDeltaTotal)}
              </span>
              <span className="rounded-lg bg-slate-50 px-3 py-2 font-semibold text-slate-700">
                Desvío abs.: {item.meanAbsoluteDeviation.toFixed(2)} pp
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="p-3">Hospital</th>
              <th className="p-3">Casos confirmados</th>
              <th className="p-3">Delta promedio</th>
              <th className="p-3">Desvío absoluto promedio</th>
            </tr>
          </thead>
          <tbody>
            {confirmation.byHospital.map((item) => (
              <tr key={item.hospital} className="border-b border-slate-100 last:border-0">
                <td className="p-3 font-semibold">{item.hospital}</td>
                <td className="p-3">{integer(item.confirmedCount)}</td>
                <td className={`p-3 font-semibold ${deltaTone(item.avgDeltaTotal)}`}>{signedPp(item.avgDeltaTotal)}</td>
                <td className="p-3 font-semibold">{item.meanAbsoluteDeviation.toFixed(2)} pp</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfirmationsList({ data }: { data: DashboardData }) {
  if (data.confirmedRows.length === 0) {
    return <p className="text-sm text-slate-500">Todavía no hay confirmaciones del hospital receptor.</p>;
  }

  return (
    <div className="space-y-3">
      {data.confirmedRows.map((row) => (
        <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Confirmado: {formatDate(row.confirmedAt)}</span>
            <span className="font-semibold text-slate-700">{row.hospital || 'Hospital sin dato'}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
            <span className="font-semibold text-slate-700">
              Estimado: <span className="text-slate-900">{percent(row.estimatedBurnPercentage)}</span>
            </span>
            <span className="font-semibold text-slate-700">
              Confirmado: <span className="text-slate-900">{percent(row.actualBurnPercentage)}</span>
            </span>
            <span className={`font-bold ${row.deltaPercentage === 0 ? 'text-slate-500' : row.deltaPercentage > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              Delta: {row.deltaPercentage > 0 ? '+' : ''}{row.deltaPercentage.toFixed(2)} pp
            </span>
          </div>
          {row.areaDeltas.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {row.areaDeltas.map((area) => (
                <div key={area.areaKey} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-700">
                    {area.label}{area.side ? ` (${area.side})` : ''}:
                  </span>{' '}
                  <span className="text-slate-600">
                    {area.estimatedPercentage}% → {area.actualPercentage}%
                  </span>{' '}
                  <span className={area.deltaPercentage === 0 ? 'text-slate-500' : area.deltaPercentage > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                    ({area.deltaPercentage > 0 ? '+' : ''}{area.deltaPercentage})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LoadingModal({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <RefreshCw className="h-7 w-7 animate-spin" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Cargando dashboard</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
          Esto puede tardar unos minutos mientras se cargan todos los registros.
        </p>
      </div>
    </div>
  );
}

function DataTable({
  data,
  filters,
  onPageChange,
}: {
  data: DashboardData;
  filters: DashboardFilters;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Edad</th>
              <th className="p-3">Sexo</th>
              <th className="p-3">Ubicación / Región</th>
              <th className="p-3">Donde ocurrió</th>
              <th className="p-3">Donde se atendió</th>
              <th className="p-3">Hospital</th>
              <th className="p-3">Agente causal</th>
              <th className="p-3">Vía aérea</th>
              <th className="p-3">Tipo de manejo</th>
              <th className="p-3">Marca indicada</th>
              <th className="p-3">% SCT</th>
              <th className="p-3">Gravedad</th>
              <th className="p-3">Fórmula</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {data.rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap p-3">{formatDate(row.createdAt)}</td>
                <td className="p-3">{row.age.toFixed(row.age < 1 ? 1 : 0)}</td>
                <td className="p-3">{row.gender || 'Sin dato'}</td>
                <td className="p-3">{row.location || 'Sin dato'}</td>
                <td className="p-3">{row.accidentPlace || 'Sin dato'}</td>
                <td className="p-3">{row.servicio || 'Sin dato'}</td>
                <td className="p-3">{row.hospital || 'Sin dato'}</td>
                <td className="p-3">{row.causalAgent || 'Sin dato'}</td>
                <td className="p-3">{yesNo(row.airwayCompromise)}</td>
                <td className="p-3">{row.careSetting === 'ambulatorio' ? 'Ambulatorio' : row.careSetting === 'internacion' ? 'Internación' : 'Sin dato'}</td>
                <td className="p-3">{row.medicationBrand || '—'}</td>
                <td className="p-3 font-bold text-rose-600">{percent(row.burnPercentage)}</td>
                <td className="p-3">{row.garcesSeverityGroup || 'Sin clasificar'}</td>
                <td className="p-3">{displayFormula(row.formulaType)}</td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-sm text-slate-500" colSpan={13}>
                  No hay registros para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 p-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Mostrando página {data.page} de {data.totalPages} ({data.totalFiltered} registros)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={(filters.page || 1) <= 1}
            onClick={() => onPageChange(Math.max((filters.page || 1) - 1, 1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={(filters.page || 1) >= data.totalPages}
            onClick={() => onPageChange((filters.page || 1) + 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await loginAdmin(password);
      onSuccess();
    } catch (loginError) {
      setError(
        loginError instanceof Error && loginError.message.includes('admin_auth_not_configured')
          ? 'El acceso administrador no está configurado en Vercel.'
          : 'No se pudo iniciar sesión como administrador.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <form onSubmit={handleSubmit} className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-rose-600 p-3 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Acceso administrador</h2>
            <p className="text-sm text-slate-500">Ingrese la clave exclusiva del dashboard.</p>
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Contraseña admin</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={!password || isSubmitting}
          className="mt-5 w-full rounded-lg bg-rose-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? 'Validando...' : 'Entrar al dashboard'}
        </button>
      </form>
    </div>
  );
}

const CALCULATOR_URL = 'https://www.regladecuadrantes.com/';

export function AdminDashboard() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [data, setData] = useState<DashboardData | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({ page: 1, pageSize: 12 });
  const [activeTab, setActiveTab] = useState<TabKey>('demographics');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedDashboardRef = useRef(false);
  const skipNextLoadEffectRef = useRef(false);
  const sessionGenerationRef = useRef(0);

  const returnToLogin = () => {
    sessionGenerationRef.current += 1;
    setData(null);
    setError('');
    setIsLoading(false);
    hasLoadedDashboardRef.current = false;
    skipNextLoadEffectRef.current = false;
    setAuthStatus('unauthenticated');
  };

  const agentOptions = useMemo(
    () => [
      { value: 'ALL', label: 'Todos los agentes' },
      ...(data?.filterOptions.causalAgents || [])
        .filter((agent) => agent !== 'Sin dato')
        .map((agent) => ({ value: agent, label: agent })),
    ],
    [data?.filterOptions.causalAgents],
  );

  const genderOptions = useMemo(
    () => [
      { value: 'ALL', label: 'Todos' },
      ...(data?.filterOptions.genders || [])
        .filter((gender) => gender !== 'Sin dato')
        .map((gender) => ({ value: gender, label: gender })),
    ],
    [data?.filterOptions.genders],
  );

  const loadData = async (nextFilters = filters, forceRefresh = false) => {
    const generation = sessionGenerationRef.current;
    setIsLoading(true);
    setError('');
    try {
      const dashboardData = await fetchDashboardData({
        ...nextFilters,
        refresh: forceRefresh || undefined,
      });
      if (generation !== sessionGenerationRef.current) return;
      setData(dashboardData);
      hasLoadedDashboardRef.current = true;
      if (authStatus !== 'authenticated') {
        skipNextLoadEffectRef.current = true;
      }
      setAuthStatus('authenticated');
    } catch (loadError) {
      if (generation !== sessionGenerationRef.current) return;
      if (loadError instanceof DashboardApiError && loadError.status === 401) {
        returnToLogin();
      } else {
        setError('No se pudieron cargar los datos del dashboard.');
      }
    } finally {
      if (generation === sessionGenerationRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let checking = false;
    let initialized = false;

    async function checkSession() {
      if (checking) return;
      checking = true;
      const generation = sessionGenerationRef.current;
      try {
        const ok = await fetchAdminSessionStatus();
        if (cancelled || generation !== sessionGenerationRef.current) return;
        if (!ok) {
          initialized = true;
          returnToLogin();
          return;
        }
        if (!initialized) {
          initialized = true;
          setAuthStatus('authenticated');
          await loadData(filters);
        }
      } catch (sessionError) {
        console.error('Failed to validate admin session', sessionError);
        if (!cancelled && generation === sessionGenerationRef.current) {
          initialized = true;
          returnToLogin();
          setError('No se pudo verificar la sesión del administrador. Intente nuevamente.');
        }
      } finally {
        checking = false;
      }
    }

    void checkSession();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void checkSession();
    };
    window.addEventListener('focus', checkSession);
    window.addEventListener('pageshow', checkSession);
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void checkSession();
    }, 60000);
    return () => {
      cancelled = true;
      sessionGenerationRef.current += 1;
      window.removeEventListener('focus', checkSession);
      window.removeEventListener('pageshow', checkSession);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !hasLoadedDashboardRef.current) return;
    if (skipNextLoadEffectRef.current) {
      skipNextLoadEffectRef.current = false;
      return;
    }
    void loadData(filters);
  }, [filters, authStatus]);

  const updateFilter = (key: keyof DashboardFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  };

  const handleLogout = async () => {
    try {
      await logoutAdmin();
      returnToLogin();
    } catch (logoutError) {
      console.error('Failed to log out admin', logoutError);
      setError('No se pudo cerrar la sesión. Intente nuevamente.');
    }
  };

  if (authStatus === 'checking') {
    return (
      <LoadingModal message="Verificando acceso administrador..." />
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <>
        {error && <p role="alert" className="mx-auto max-w-md p-4 text-sm text-red-700">{error}</p>}
        <AdminLogin onSuccess={() => {
          sessionGenerationRef.current += 1;
          void loadData(filters);
        }} />
        {isLoading && (
          <LoadingModal message="Acceso validado. Estamos consultando la base de datos y preparando las métricas." />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {isLoading && (
        <LoadingModal message="Consultando la base de datos y actualizando todas las métricas visibles." />
      )}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900 text-white shadow-md">
        <div className="mx-auto flex h-auto max-w-7xl flex-col gap-3 px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-xl bg-rose-600 p-2 text-white shadow-lg">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold leading-tight">
                BurnMetrics Admin
                <span className="rounded-full border border-rose-500/30 bg-rose-500/20 px-2 py-0.5 text-xs font-medium text-rose-300">
                  DB
                </span>
              </h1>
              <p className="text-xs text-slate-400">Analítica de quemaduras y simulaciones clínicas</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadData(filters, true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <a
              href={CALCULATOR_URL}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200"
            >
              Calculadora
            </a>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-xs">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>
              Base conectada con <strong>{data?.totalAvailable || 0} registros</strong>.
              {data && ` Mostrando ${data.totalFiltered} casos filtrados.`}
              {' '}Los datos se guardan en memoria por día; use Actualizar para recargar desde la base.
            </span>
          </div>
        </div>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <SlidersHorizontal className="h-4 w-4 text-slate-600" />
              Filtros de datos
            </span>
            <button
              type="button"
              onClick={() => setFilters({ page: 1, pageSize: 12 })}
              className="text-xs font-semibold text-emerald-700 underline"
            >
              Restablecer filtros
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <FilterSelect label="Sexo" value={filters.gender || 'ALL'} options={genderOptions} onChange={(value) => updateFilter('gender', value)} />
            <FilterSelect label="Rango de edad" value={filters.ageGroup || 'ALL'} options={ageOptions} onChange={(value) => updateFilter('ageGroup', value)} />
            <FilterSelect
              label="Compromiso vía aérea"
              value={filters.airway || 'ALL'}
              options={[
                { value: 'ALL', label: 'Todos' },
                { value: 'true', label: 'Sí' },
                { value: 'false', label: 'No' },
              ]}
              onChange={(value) => updateFilter('airway', value)}
            />
            <FilterSelect label="Agente causal" value={filters.agent || 'ALL'} options={agentOptions} onChange={(value) => updateFilter('agent', value)} />
            <FilterSelect label="Índice / gravedad" value={filters.severity || 'ALL'} options={severityOptions} onChange={(value) => updateFilter('severity', value)} />
            <FilterSelect label="Fórmula hídrica" value={filters.formula || 'ALL'} options={formulaOptions} onChange={(value) => updateFilter('formula', value)} />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Buscar por paciente, ubicación, agente o gravedad..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </section>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
          <KpiCard
            label="Total pacientes"
            value={integer(data?.summary.totalCases || 0)}
            subtext={`Promedio edad: ${data?.summary.averageAge.toFixed(1) || '-'} años`}
            tone="bg-blue-50 text-blue-600"
            icon={<Users className="h-5 w-5" />}
          />
          <KpiCard
            label="Superficie quemada"
            value={percent(data?.summary.averageBurnPercentage || 0)}
            subtext={`Máximo SCT: ${percent(data?.summary.maxBurnPercentage || 0)}`}
            tone="bg-rose-50 text-rose-600"
            icon={<Activity className="h-5 w-5" />}
          />
          <KpiCard
            label="Compromiso vía aérea"
            value={percent(data?.summary.airwayRate || 0)}
            subtext={`${integer(data?.summary.airwayCount || 0)} casos confirmados`}
            tone="bg-amber-50 text-amber-600"
            icon={<Wind className="h-5 w-5" />}
          />
          <KpiCard
            label="Casos graves / críticos"
            value={integer(data?.summary.highSeverityCount || 0)}
            subtext={`${percent(data?.summary.highSeverityRate || 0)} del total`}
            tone="bg-purple-50 text-purple-600"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <KpiCard
            label="Parkland vs Galveston"
            value={`${data?.summary.formulaCounts.parkland || 0} / ${data?.summary.formulaCounts.galveston || 0}`}
            subtext="Uso de fórmulas registradas"
            tone="bg-emerald-50 text-emerald-600"
            icon={<Droplet className="h-5 w-5" />}
          />
          <KpiCard
            label="Ambulatorio vs Internación"
            value={percent(data?.summary.careSetting.ambulatorioRate || 0)}
            subtext={`${integer(data?.summary.careSetting.ambulatorioCount || 0)} ambulatorios / ${integer(data?.summary.careSetting.internacionCount || 0)} internados`}
            tone="bg-fuchsia-50 text-fuchsia-600"
            icon={<ShieldCheck className="h-5 w-5" />}
          />
          <KpiCard
            label="Confirmación hospitalaria"
            value={percent(data?.summary.confirmation.confirmationRate || 0)}
            subtext={`Delta promedio: ${(data?.summary.confirmation.avgDeltaTotal || 0) > 0 ? '+' : ''}${(data?.summary.confirmation.avgDeltaTotal || 0).toFixed(1)} pp · Desvío abs.: ${(data?.summary.confirmation.meanAbsoluteDeviation || 0).toFixed(1)} pp`}
            tone="bg-teal-50 text-teal-600"
            icon={<ClipboardCheck className="h-5 w-5" />}
          />
        </section>

        <div className="flex flex-wrap gap-2 rounded-t-2xl border-b border-slate-200 bg-white px-4 pt-2 text-sm font-medium shadow-xs">
          {[
            { key: 'demographics' as const, label: '1. Demografía y Epidemiología', icon: <PieChart className="h-4 w-4" /> },
            { key: 'surface' as const, label: '2 y 3. SCT e Índice Gravedad', icon: <BarChart3 className="h-4 w-4" /> },
            { key: 'formulas' as const, label: '4. Parkland & Galveston', icon: <Droplet className="h-4 w-4" /> },
            { key: 'confirmations' as const, label: 'Confirmaciones del hospital', icon: <ClipboardCheck className="h-4 w-4" /> },
            { key: 'table' as const, label: 'Tabla de Datos', icon: <Table className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-1 py-3 transition-colors ${
                activeTab === tab.key
                  ? 'border-rose-600 font-semibold text-rose-600'
                  : 'border-transparent text-slate-600 hover:text-rose-600'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {data && activeTab === 'demographics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Panel title="Agente causal de la quemadura" subtitle="Distribución por tipo de agente" icon={<Flame className="h-4 w-4 text-rose-500" />}>
                <MultiAnswerPieChart items={data.breakdowns.causalAgent} />
              </Panel>
              <Panel title="Distribución por edad y sexo" subtitle="Rangos etarios y sexo registrado" icon={<Users className="h-4 w-4 text-blue-500" />}>
                <AgeGenderChart ageGroups={data.breakdowns.ageGroups} gender={data.breakdowns.gender} />
              </Panel>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4">
              <Panel title="Lugar del accidente" subtitle="Hogar, escuela, trabajo, vía pública, otros" icon={<PieChart className="h-4 w-4 text-amber-500" />}>
                <MultiAnswerPieChart items={data.breakdowns.accidentPlace} />
              </Panel>
              <Panel title="Dónde se atendió" subtitle="Servicio o institución registrada" icon={<Database className="h-4 w-4 text-emerald-500" />}>
                <MultiAnswerPieChart items={data.breakdowns.servicio} />
              </Panel>
              <Panel title="Hospital" subtitle="Garrahan, Elizalde u otros" icon={<Database className="h-4 w-4 text-teal-500" />}>
                <MultiAnswerPieChart items={data.breakdowns.hospital} />
              </Panel>
              <Panel title="Vía aérea comprometida" subtitle="Casos positivos por agente causal" icon={<Wind className="h-4 w-4 text-indigo-500" />}>
                <MultiAnswerPieChart items={data.breakdowns.airwayByAgent} emptyLabel="No hay casos con vía aérea comprometida." />
              </Panel>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Panel title="Tipo de manejo" subtitle="Internación vs. Ambulatorio" icon={<ShieldCheck className="h-4 w-4 text-purple-500" />}>
                <MultiAnswerPieChart items={data.breakdowns.careSetting} />
              </Panel>
              <Panel title="Marca indicada" subtitle="Sulfadiazina de plata (casos ambulatorios)" icon={<Droplet className="h-4 w-4 text-sky-500" />}>
                <MultiAnswerPieChart items={data.breakdowns.medicationBrand} emptyLabel="No hay casos ambulatorios con marca indicada." />
              </Panel>
            </div>
          </div>
        )}

        {data && activeTab === 'surface' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Panel title="Distribución de superficie quemada (% SCT)" subtitle="Rangos de porcentaje" icon={<Activity className="h-4 w-4 text-rose-500" />}>
                <MultiAnswerPieChart items={data.breakdowns.burnBuckets} />
              </Panel>
              <Panel title="Clasificación por índice de gravedad" subtitle="Leve, moderado, grave, crítico" icon={<AlertTriangle className="h-4 w-4 text-purple-500" />}>
                <MultiAnswerPieChart items={data.breakdowns.severity} />
              </Panel>
            </div>
            <Panel title="Ubicación geográfica del accidente" subtitle="Provincia o región registrada en la primera hoja" icon={<BarChart3 className="h-4 w-4 text-indigo-600" />}>
              <MultiAnswerPieChart items={data.breakdowns.location} />
            </Panel>
          </div>
        )}

        {data && activeTab === 'formulas' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Panel title="Selección de fórmula" subtitle="Uso registrado de Parkland y Galveston" icon={<PieChart className="h-4 w-4 text-emerald-600" />}>
                <TwoAnswerBarChart items={data.breakdowns.formula} />
              </Panel>
              <div className="lg:col-span-2">
                <Panel title="Estimación de fluidos primeras 24 horas" subtitle="Promedios por gravedad" icon={<Droplet className="h-4 w-4 text-blue-600" />}>
                  <FluidAverages data={data} />
                </Panel>
              </div>
            </div>
          </div>
        )}

        {data && activeTab === 'confirmations' && (
          <div className="space-y-6">
            <Panel
              title="Desvío de la estimación por hospital"
              subtitle="Casos confirmados (internación y ambulatorio): delta = % confirmado − % estimado, en puntos porcentuales"
              icon={<BarChart3 className="h-4 w-4 text-teal-600" />}
            >
              <ConfirmationDeltaMetrics data={data} />
            </Panel>
            <Panel
              title="Confirmaciones del hospital receptor"
              subtitle="Comparación entre valores estimados y confirmados/editados por el hospital"
              icon={<ClipboardCheck className="h-4 w-4 text-teal-600" />}
            >
              <ConfirmationsList data={data} />
            </Panel>
          </div>
        )}

        {data && activeTab === 'table' && (
          <DataTable
            data={data}
            filters={filters}
            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
          />
        )}
      </main>
    </div>
  );
}
