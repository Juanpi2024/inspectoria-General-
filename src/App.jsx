import React, { useState, useEffect } from 'react';
import { 
  Save, FileText, TrendingUp, TrendingDown, Minus, 
  UserPlus, UserMinus, AlertTriangle, CheckCircle, Info, Printer, Loader2, Plus, Calendar
} from 'lucide-react';
import './index.css';

const defaultData = {
  periodo: '',
  matriculaTotal: 136,
  asistenciaPromedio: 0,
  riesgoRepitencia: 0,
  nuevasIncorporaciones: 0,
  retirosEfectivos: 0,
  analisisPermanencia: '',
  alertas: [],
  casosDeserciones: 0,
  casosLicencias: 0,
  casosCambios: 0,
  observaciones: ''
};

export default function App() {
  const [activeTab, setActiveTab] = useState('ingreso');
  const [loading, setLoading] = useState(true);
  const [reportesList, setReportesList] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [data, setData] = useState(defaultData);

  useEffect(() => {
    // Cargar desde almacenamiento local
    try {
      const saved = localStorage.getItem('inspectoria_historial');
      if (saved) {
        const list = JSON.parse(saved);
        list.sort((a,b) => b.id.localeCompare(a.id));
        setReportesList(list);

        if (list.length > 0) {
          setCurrentId(list[0].id);
          setData(list[0]);
        }
      }
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Guardar en almacenamiento local
    if (loading || !currentId) return;
    
    const timer = setTimeout(() => {
      setReportesList(prev => {
        const exists = prev.find(p => p.id === currentId);
        let newList;
        if (exists) {
          newList = prev.map(p => p.id === currentId ? {id: currentId, ...data} : p);
        } else {
          newList = [{id: currentId, ...data}, ...prev].sort((a,b) => b.id.localeCompare(a.id));
        }
        
        localStorage.setItem('inspectoria_historial', JSON.stringify(newList));
        return newList;
      });
    }, 500); // Pequeño retraso para no saturar
    
    return () => clearTimeout(timer);
  }, [data, loading, currentId]);

  const handleSelectReporte = (id) => {
    const found = reportesList.find(r => r.id === id);
    if (found) {
      setCurrentId(id);
      setData(found);
    }
  };

  const handleCreateNew = () => {
    const monthYear = prompt("Ingrese el mes y año (ej: Abril 2026):");
    if (!monthYear) return;
    
    const id = monthYear.toLowerCase().replace(/\s+/g, '-');
    const newData = { ...defaultData, periodo: monthYear };
    
    setCurrentId(id);
    setData(newData);
    setActiveTab('ingreso');
  };

  const [nuevaAlerta, setNuevaAlerta] = useState({
    nombre: '',
    asistenciaMes: '',
    asistenciaAcum: '',
    accion: 'Derivado a Dupla Psicosocial'
  });

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleAddAlerta = (e) => {
    e.preventDefault();
    if (!nuevaAlerta.nombre) return;
    
    setData(prev => ({
      ...prev,
      alertas: [...prev.alertas, { ...nuevaAlerta, id: Date.now() }]
    }));
    
    setNuevaAlerta({
      nombre: '',
      asistenciaMes: '',
      asistenciaAcum: '',
      accion: 'Derivado a Dupla Psicosocial'
    });
  };

  const handleRemoveAlerta = (id) => {
    setData(prev => ({
      ...prev,
      alertas: prev.alertas.filter(a => a.id !== id)
    }));
  };

  const clearData = () => {
    if (window.confirm('¿Está seguro de querer limpiar todos los datos?')) {
      setData(defaultData);
    }
  };

  const printReport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--primary)' }}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ textAlign: 'left' }}>Sistema Inspectoría CEIA</h1>
          <p style={{ color: 'var(--text-muted)' }}>Gestión de Eficiencia Interna y Matrícula</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select 
            value={currentId || ''} 
            onChange={(e) => handleSelectReporte(e.target.value)}
            style={{ width: '200px', padding: '0.5rem', background: 'var(--bg-card)' }}
            disabled={!currentId}
          >
            {reportesList.length === 0 && <option value="">Sin reportes</option>}
            {reportesList.map(r => (
              <option key={r.id} value={r.id}>{r.periodo}</option>
            ))}
          </select>
          <button className="primary" onClick={handleCreateNew}>
            <Plus size={18} /> Nuevo Mes
          </button>
        </div>
      </header>

      <div className="tabs no-print">
        <button 
          className={`tab ${activeTab === 'ingreso' ? 'active' : ''}`}
          onClick={() => setActiveTab('ingreso')}
          disabled={!currentId}
        >
          <Save size={18} /> Ingreso de Datos
        </button>
        <button 
          className={`tab ${activeTab === 'reporte' ? 'active' : ''}`}
          onClick={() => setActiveTab('reporte')}
          disabled={!currentId}
        >
          <FileText size={18} /> Reporte Mensual
        </button>
      </div>

      {!currentId && !loading && (
        <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Calendar size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', opacity: 0.8 }} />
          <h2>Aún no hay reportes de inspectoría</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Comienza creando el primer reporte mensual para ingresar los datos.
          </p>
          <button className="primary" onClick={handleCreateNew}>
            <Plus size={18} /> Crear Primer Reporte
          </button>
        </div>
      )}

      {currentId && activeTab === 'ingreso' && (
        <div className="animate-fade-in no-print">
          <div className="card">
            <h2>Datos Generales del Periodo</h2>
            <div className="grid-2">
              <div className="form-group">
                <label>Periodo (Mes / Año)</label>
                <input 
                  type="text" 
                  name="periodo" 
                  value={data.periodo} 
                  onChange={handleChange} 
                  placeholder="Ej: Abril 2026"
                />
              </div>
              <div className="form-group">
                <label>Matrícula Total (Meta ≥ 136)</label>
                <input 
                  type="number" 
                  name="matriculaTotal" 
                  value={data.matriculaTotal} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Asistencia Promedio % (Meta ≥ 60%)</label>
                <input 
                  type="number" 
                  name="asistenciaPromedio" 
                  value={data.asistenciaPromedio} 
                  onChange={handleChange} 
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label>Riesgo Repitencia % (Meta &lt; 10%)</label>
                <input 
                  type="number" 
                  name="riesgoRepitencia" 
                  value={data.riesgoRepitencia} 
                  onChange={handleChange} 
                  step="0.1"
                />
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <h2>Altas y Bajas (Evidencia Meta 13)</h2>
              <div className="form-group">
                <label>N° Nuevas Incorporaciones</label>
                <input 
                  type="number" 
                  name="nuevasIncorporaciones" 
                  value={data.nuevasIncorporaciones} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>N° Retiros Efectivos</label>
                <input 
                  type="number" 
                  name="retirosEfectivos" 
                  value={data.retirosEfectivos} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Análisis de Permanencia</label>
                <textarea 
                  name="analisisPermanencia" 
                  value={data.analisisPermanencia} 
                  onChange={handleChange}
                  placeholder="Breve comentario sobre si la matrícula se mantiene estable o si hay fuga..."
                />
              </div>
            </div>

            <div className="card">
              <h2>Casos Justificados "Supuestos Básicos"</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Respaldo para eximente del 25%
              </p>
              <div className="form-group">
                <label>Deserciones documentadas</label>
                <input 
                  type="number" 
                  name="casosDeserciones" 
                  value={data.casosDeserciones} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Licencias Médicas/Salud</label>
                <input 
                  type="number" 
                  name="casosLicencias" 
                  value={data.casosLicencias} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group">
                <label>Cambios de Domicilio/Laborales</label>
                <input 
                  type="number" 
                  name="casosCambios" 
                  value={data.casosCambios} 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Alerta Temprana de Repitencia (Evidencia Meta 14)</h2>
            <form onSubmit={handleAddAlerta} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Nombre Estudiante</label>
                <input required type="text" value={nuevaAlerta.nombre} onChange={e => setNuevaAlerta({...nuevaAlerta, nombre: e.target.value})} />
              </div>
              <div className="form-group" style={{ width: '100px', marginBottom: 0 }}>
                <label>% Mes</label>
                <input required type="number" value={nuevaAlerta.asistenciaMes} onChange={e => setNuevaAlerta({...nuevaAlerta, asistenciaMes: e.target.value})} />
              </div>
              <div className="form-group" style={{ width: '100px', marginBottom: 0 }}>
                <label>% Acum.</label>
                <input required type="number" value={nuevaAlerta.asistenciaAcum} onChange={e => setNuevaAlerta({...nuevaAlerta, asistenciaAcum: e.target.value})} />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Acción Realizada</label>
                <select value={nuevaAlerta.accion} onChange={e => setNuevaAlerta({...nuevaAlerta, accion: e.target.value})}>
                  <option value="Derivado a Dupla Psicosocial">Derivado a Dupla</option>
                  <option value="Citación de apoderado/adulto">Citación Apoderado</option>
                  <option value="Entrevista Personal">Entrevista Personal</option>
                  <option value="Visita Domiciliaria">Visita Domiciliaria</option>
                </select>
              </div>
              <button type="submit" className="primary" style={{ marginBottom: '2px' }}>Agregar</button>
            </form>

            {data.alertas.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>% Mes</th>
                      <th>% Acum</th>
                      <th>Acción</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.alertas.map(a => (
                      <tr key={a.id}>
                        <td>{a.nombre}</td>
                        <td>{a.asistenciaMes}%</td>
                        <td>{a.asistenciaAcum}%</td>
                        <td>{a.accion}</td>
                        <td>
                          <button 
                            className="danger" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleRemoveAlerta(a.id)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No hay estudiantes en alerta registrados.</p>
            )}
          </div>

          <div className="card">
            <h2>Observaciones y Requerimientos</h2>
            <div className="form-group">
              <textarea 
                name="observaciones" 
                value={data.observaciones} 
                onChange={handleChange}
                placeholder="Solicitudes de recursos, nudos críticos (ej. falta de firmas, desfase SIGE)..."
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '1rem' }}>
             <button className="secondary" onClick={clearData}>Limpiar Datos</button>
             <button className="primary" onClick={() => setActiveTab('reporte')}>
               <FileText size={18} /> Generar Reporte
             </button>
          </div>
        </div>
      )}

      {activeTab === 'reporte' && (
        <div className="animate-fade-in" id="printable-report">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ marginBottom: '0.25rem', fontSize: '2rem' }}>Reporte Mensual: Inspectoría General</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Dirección CEIA Juanita Zúñiga Fuentes</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button className="primary no-print" onClick={printReport}>
                <Printer size={18} /> Imprimir Reporte
              </button>
              <div style={{ marginTop: '1rem', fontWeight: 600 }}>Periodo: {data.periodo || '[No especificado]'}</div>
            </div>
          </div>

          <div className="card">
            <h2>1. Tablero de Control de Metas (Eficiencia Interna)</h2>
            <div className="grid-3" style={{ marginTop: '1.5rem' }}>
              
              {/* Matrícula */}
              <div className="metric-card">
                <div className="metric-title">Matrícula Total</div>
                <div className={`metric-value ${data.matriculaTotal >= 136 ? 'status-green' : 'status-red'}`}>
                  {data.matriculaTotal}
                </div>
                <div className="metric-meta">
                  Meta ≥ 136 | 
                  {data.matriculaTotal >= 136 ? 
                    <><CheckCircle size={14} className="status-green" /> Cumple</> : 
                    <><AlertTriangle size={14} className="status-red" /> Riesgo</>
                  }
                </div>
              </div>

              {/* Asistencia */}
              <div className="metric-card">
                <div className="metric-title">Asistencia Promedio</div>
                <div className={`metric-value ${data.asistenciaPromedio >= 60 ? 'status-green' : (data.asistenciaPromedio >= 55 ? 'status-yellow' : 'status-red')}`}>
                  {data.asistenciaPromedio}%
                </div>
                <div className="metric-meta">
                  Meta ≥ 60% | 
                  {data.asistenciaPromedio >= 60 ? <><CheckCircle size={14} className="status-green" /> Cumple</> : 
                   data.asistenciaPromedio >= 55 ? <><Info size={14} className="status-yellow" /> Alerta</> :
                   <><AlertTriangle size={14} className="status-red" /> Riesgo</>}
                </div>
              </div>

              {/* Riesgo Repitencia */}
              <div className="metric-card">
                <div className="metric-title">Riesgo Repitencia</div>
                <div className={`metric-value ${data.riesgoRepitencia < 10 ? 'status-green' : (data.riesgoRepitencia <= 15 ? 'status-yellow' : 'status-red')}`}>
                  {data.riesgoRepitencia}%
                </div>
                <div className="metric-meta">
                  Meta &lt; 10% | 
                  {data.riesgoRepitencia < 10 ? <><CheckCircle size={14} className="status-green" /> Cumple</> : 
                   data.riesgoRepitencia <= 15 ? <><Info size={14} className="status-yellow" /> Alerta</> :
                   <><AlertTriangle size={14} className="status-red" /> Riesgo</>}
                </div>
              </div>

            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <h2>2. Gestión de Altas y Bajas</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>Movimientos de matrícula del mes (Evidencia Meta 13).</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UserPlus size={16} className="status-green" /> Nuevas Incorporaciones:</span>
                  <strong>{data.nuevasIncorporaciones}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UserMinus size={16} className="status-red" /> Retiros Efectivos:</span>
                  <strong>{data.retirosEfectivos}</strong>
                </div>
                
                <div style={{ marginTop: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem' }}>Análisis de Permanencia:</h3>
                  <p style={{ 
                    padding: '1rem', 
                    background: 'rgba(255,255,255,0.03)', 
                    borderRadius: '8px',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {data.analisisPermanencia || 'Sin observaciones registradas.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <h2>4. Respaldo "Supuestos Básicos"</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                Resumen de Casos Justificados. Importante: Cada caso debe tener respaldo en la Carpeta Crítica.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <span>Deserciones documentadas:</span>
                  <strong>{data.casosDeserciones}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <span>Licencias Médicas/Salud:</span>
                  <strong>{data.casosLicencias}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <span>Cambios de Domicilio/Laborales:</span>
                  <strong>{data.casosCambios}</strong>
                </div>
                
                <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px' }}>
                  <strong style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={16} /> Nota para Inspectoría
                  </strong>
                  <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    Si la meta no se cumple, el Director invocará la cláusula de eximente con estos {Number(data.casosDeserciones) + Number(data.casosLicencias) + Number(data.casosCambios)} casos presentados.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>3. Alerta Temprana de Repitencia</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Nómina de estudiantes por debajo del umbral de asistencia (Evidencia Meta 14).
            </p>
            
            {data.alertas.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre del Estudiante</th>
                      <th>% Asistencia Mes</th>
                      <th>% Asistencia Acumulada</th>
                      <th>Acción Realizada (Derivación)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.alertas.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500 }}>{a.nombre}</td>
                        <td>{a.asistenciaMes}%</td>
                        <td>{a.asistenciaAcum}%</td>
                        <td>
                          <span style={{ 
                            padding: '0.25rem 0.5rem', 
                            background: 'rgba(59, 130, 246, 0.1)', 
                            color: 'var(--primary)',
                            borderRadius: '4px',
                            fontSize: '0.85rem'
                          }}>
                            {a.accion}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                No se registraron estudiantes en riesgo para este periodo.
              </p>
            )}
          </div>

          <div className="card">
            <h2>5. Observaciones y Requerimientos</h2>
            <p style={{ 
              padding: '1rem', 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '8px',
              whiteSpace: 'pre-wrap',
              minHeight: '80px'
            }}>
              {data.observaciones || 'No hay requerimientos adicionales para este periodo.'}
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
