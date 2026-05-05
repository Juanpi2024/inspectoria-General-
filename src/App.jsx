import React, { useState, useEffect, useMemo } from 'react';
import { 
  Save, FileText, TrendingUp, TrendingDown, Minus, 
  UserPlus, UserMinus, AlertTriangle, CheckCircle, Info, Printer, Loader2, Plus, Calendar, Cloud, CloudOff, RefreshCw, User
} from 'lucide-react';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import './index.css';

const CURSOS_OFICIALES = [
  '7Y8', '1Y2 HC', '3Y4 HC', '1Y2 ELE', '3 ELEC', 
  '4 ELEC', '1Y2 PAR', '3 PAR', '4 PAR'
];

const defaultData = {
  periodo: '',
  matriculaTotal: 136,
  asistenciaPromedio: 0,
  riesgoRepitencia: 0,
  nuevasIncorporaciones: 0,
  retirosEfectivos: 0,
  analisisPermanencia: '',
  alertas: [],
  licencias: [],
  casosDeserciones: 0,
  casosLicencias: 0,
  casosCambios: 0,
  observaciones: ''
};

export default function App() {
  const [activeTab, setActiveTab] = useState('ingreso');
  const [subTab, setSubTab] = useState('resumen');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Conectando con la base de datos...');
  const [offlineMode, setOfflineMode] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [reportesList, setReportesList] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [data, setData] = useState(defaultData);
  const [searchTermAlertas, setSearchTermAlertas] = useState('');
  const [filterCriticos, setFilterCriticos] = useState(false);
  const [searchTermLicencias, setSearchTermLicencias] = useState('');
  const [showAlertaModal, setShowAlertaModal] = useState(false);
  const [showLicenciaModal, setShowLicenciaModal] = useState(false);
  const [modalPosition, setModalPosition] = useState(null);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState('');

  const studentHistory = useMemo(() => {
    if (!selectedStudentForReport) return null;
    const history = { alertas: [], licencias: [] };
    const searchName = selectedStudentForReport.toLowerCase();

    // Histórico
    reportesList.forEach(r => {
      if (r.id === currentId) return; // Evitar duplicar el mes actual
      const alertas = (r.alertas || []).filter(a => a.nombre.toLowerCase().includes(searchName)).map(a => ({...a, periodoStr: r.periodo}));
      const licencias = (r.licencias || []).filter(l => l.nombre.toLowerCase().includes(searchName)).map(l => ({...l, periodoStr: r.periodo}));
      history.alertas.push(...alertas);
      history.licencias.push(...licencias);
    });

    // Mes actual
    const currentAlertas = (data.alertas || []).filter(a => a.nombre.toLowerCase().includes(searchName)).map(a => ({...a, periodoStr: data.periodo + ' (Actual)'}));
    const currentLicencias = (data.licencias || []).filter(l => l.nombre.toLowerCase().includes(searchName)).map(l => ({...l, periodoStr: data.periodo + ' (Actual)'}));
    
    history.alertas.push(...currentAlertas);
    history.licencias.push(...currentLicencias);

    return history;
  }, [selectedStudentForReport, reportesList, data, currentId]);

  const periodosAgrupados = useMemo(() => {
    if (!studentHistory) return [];
    const map = new Map();

    studentHistory.alertas.forEach(a => {
      if (!map.has(a.periodoStr)) map.set(a.periodoStr, { alertas: [], licencias: [] });
      map.get(a.periodoStr).alertas.push(a);
    });

    studentHistory.licencias.forEach(l => {
      if (!map.has(l.periodoStr)) map.set(l.periodoStr, { alertas: [], licencias: [] });
      map.get(l.periodoStr).licencias.push(l);
    });

    // Helper para extraer el mes
    const getMonthIndex = (periodo) => {
      const p = periodo.toLowerCase();
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      for (let i = 0; i < meses.length; i++) {
        if (p.includes(meses[i])) return i;
      }
      return -1;
    };

    // Helper para extraer el año
    const getYear = (periodo) => {
      const match = periodo.match(/\d{4}/);
      return match ? parseInt(match[0]) : 0;
    };

    return Array.from(map.entries()).map(([periodo, d]) => ({ periodo, ...d }))
      .sort((a, b) => {
        const yearA = getYear(a.periodo);
        const yearB = getYear(b.periodo);
        if (yearA !== yearB) return yearA - yearB;
        return getMonthIndex(a.periodo) - getMonthIndex(b.periodo);
      });
  }, [studentHistory]);

  // Cargar desde Firebase en tiempo real con timeout de seguridad
  useEffect(() => {
    let unsubscribe = () => {};
    let resolved = false;

    // Timeout: si en 5 segundos no carga, arrancar sin Firebase
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn("⏱️ Timeout: Firestore no respondió en 5s. Iniciando en modo offline.");
        setOfflineMode(true);
        setLoading(false);
      }
    }, 5000);

    // Mensaje progresivo
    const msgTimer = setTimeout(() => {
      if (!resolved) setLoadingMsg('Verificando base de datos Firestore...');
    }, 2000);

    try {
      unsubscribe = onSnapshot(collection(db, 'reportes'), (snapshot) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          clearTimeout(msgTimer);
        }
        const list = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...defaultData, id: docSnap.id, ...docSnap.data() });
        });
        list.sort((a, b) => b.id.localeCompare(a.id));
        setReportesList(list);
        setOfflineMode(false);
        setConfigError(null);

        // Si recién cargamos y no hay id seleccionado, elegir el primero
        setLoading(prevLoading => {
          if (prevLoading && list.length > 0) {
            setCurrentId(current => {
               if (!current) {
                 setData(list[0]);
                 return list[0].id;
               }
               return current;
            });
          }
          return false;
        });
      }, (error) => {
        console.error("Error al cargar datos desde Firebase:", error);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          clearTimeout(msgTimer);
        }
        
        // Detectar si la base de datos no existe
        if (error.code === 'not-found' || error.message.includes('database')) {
          setConfigError('DATABASE_MISSING');
        } else {
          setOfflineMode(true);
        }
        setLoading(false);
      });
    } catch (err) {
      console.error("Error al inicializar Firestore:", err);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        clearTimeout(msgTimer);
        setOfflineMode(true);
        setLoading(false);
      }
    }

    return () => {
      clearTimeout(timeout);
      clearTimeout(msgTimer);
      unsubscribe();
    };
  }, []);

  // Guardar en Firebase cuando hay cambios (solo si no estamos offline)
  useEffect(() => {
    if (loading || !currentId || offlineMode) return;
    
    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const docRef = doc(db, 'reportes', currentId);
        const { id, ...dataToSave } = data; 
        await setDoc(docRef, dataToSave, { merge: true });
        setSaveStatus('saved');
      } catch (err) {
        console.error("Error al guardar en Firebase:", err);
        setSaveStatus('error');
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [data, loading, currentId, offlineMode]);

  const handleSelectReporte = (id) => {
    // Si hay datos, primero podríamos forzar un guardado si quisieramos, pero
    // por ahora solo cambiamos de mes.
    const found = reportesList.find(r => r.id === id);
    if (found) {
      setCurrentId(id);
      setData({ ...defaultData, ...found });
      setActiveTab('ingreso'); // Forzar la pestaña de ingreso para que puedan editar
    }
  };

  const handleCreateNew = () => {
    const monthYear = prompt("Ingrese el mes y año (ej: Abril 2026):");
    if (!monthYear) return;
    
    const id = monthYear.toLowerCase().replace(/\s+/g, '-');
    
    // Precargar alumnos y calcular nueva matrícula inicial
    const alertasPrecargadas = (data.alertas || []).map((a, idx) => ({
      ...a,
      asistenciaMes: '',
      asistenciaAcumAnterior: a.asistenciaAcum || '',
      asistenciaAcum: '',
      accion: 'Sin acción',
      id: Date.now() + idx
    }));

    const matriculaCalculada = (Number(data.matriculaTotal) || 0) + (Number(data.nuevasIncorporaciones) || 0) - (Number(data.retirosEfectivos) || 0);

    const newData = { 
      ...defaultData, 
      periodo: monthYear,
      matriculaTotal: matriculaCalculada > 0 ? matriculaCalculada : 136,
      alertas: alertasPrecargadas 
    };
    
    setCurrentId(id);
    setData(newData);
    setActiveTab('ingreso');
  };

  const [nuevaAlerta, setNuevaAlerta] = useState({
    nombre: '',
    curso: '',
    asistenciaMes: '',
    asistenciaAcum: '',
    asistenciaAcumAnterior: '',
    acciones: [],
    otraAccion: ''
  });
  const [editandoAlertaId, setEditandoAlertaId] = useState(null);

  const uniqueNombres = useMemo(() => {
    const nombres = new Set();
    reportesList.forEach(r => {
      (r.alertas || []).forEach(a => { if (a.nombre) nombres.add(a.nombre); });
      (r.licencias || []).forEach(l => { if (l.nombre) nombres.add(l.nombre); });
    });
    (data.alertas || []).forEach(a => { if (a.nombre) nombres.add(a.nombre); });
    (data.licencias || []).forEach(l => { if (l.nombre) nombres.add(l.nombre); });
    return Array.from(nombres).sort();
  }, [reportesList, data.alertas, data.licencias]);

  const uniqueCursos = CURSOS_OFICIALES;

  const [nuevaLicencia, setNuevaLicencia] = useState({
    nombre: '',
    curso: '',
    diasJustificados: ''
  });

  const handleAddLicencia = (e) => {
    e.preventDefault();
    if (!nuevaLicencia.nombre) return;
    
    setData(prev => {
      const newLicencias = [...(prev.licencias || []), { ...nuevaLicencia, id: Date.now() }];
      return {
        ...prev,
        licencias: newLicencias,
        casosLicencias: newLicencias.length
      };
    });
    
    setNuevaLicencia({ nombre: '', curso: '', diasJustificados: '' });
  };

  const handleRemoveLicencia = (id) => {
    setData(prev => {
      const newLicencias = (prev.licencias || []).filter(l => l.id !== id);
      return {
        ...prev,
        licencias: newLicencias,
        casosLicencias: newLicencias.length
      };
    });
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleEditAlerta = (alerta, e) => {
    if (e && e.clientY) {
      setModalPosition(Math.min(e.clientY - 50, window.innerHeight - 500));
    } else {
      setModalPosition(null);
    }
    const opcionesPredefinidas = ['Derivado a Dupla Psicosocial', 'Citación de apoderado/adulto', 'Entrevista Personal', 'Visita Domiciliaria'];
    let accionesSeleccionadas = [];
    let otraAccion = '';

    if (alerta.accion && alerta.accion !== 'Sin acción') {
      const parts = String(alerta.accion).split(', ').map(p => p.trim());
      parts.forEach(part => {
        if (opcionesPredefinidas.includes(part)) {
          accionesSeleccionadas.push(part);
        } else {
          accionesSeleccionadas.push('Otra');
          otraAccion = part;
        }
      });
    }

    setNuevaAlerta({
      nombre: alerta.nombre,
      curso: alerta.curso || '',
      asistenciaMes: alerta.asistenciaMes,
      asistenciaAcum: alerta.asistenciaAcum,
      asistenciaAcumAnterior: alerta.asistenciaAcumAnterior || '',
      acciones: accionesSeleccionadas,
      otraAccion: otraAccion
    });
    setEditandoAlertaId(alerta.id);
    setShowAlertaModal(true);
  };

  const handleAddAlerta = (e) => {
    e.preventDefault();
    if (!nuevaAlerta.nombre) return;
    
    let finalAcciones = nuevaAlerta.acciones.filter(a => a !== 'Otra');
    if (nuevaAlerta.acciones.includes('Otra') && nuevaAlerta.otraAccion.trim()) {
      finalAcciones.push(nuevaAlerta.otraAccion.trim());
    } else if (nuevaAlerta.acciones.includes('Otra')) {
      finalAcciones.push('Otra');
    }
    const accionString = finalAcciones.length > 0 ? finalAcciones.join(', ') : 'Sin acción';
    
    if (editandoAlertaId) {
      setData(prev => ({
        ...prev,
        alertas: (prev.alertas || []).map(a => a.id === editandoAlertaId ? {
          ...a,
          nombre: nuevaAlerta.nombre,
          curso: nuevaAlerta.curso,
          asistenciaMes: nuevaAlerta.asistenciaMes,
          asistenciaAcum: nuevaAlerta.asistenciaAcum,
          asistenciaAcumAnterior: nuevaAlerta.asistenciaAcumAnterior,
          accion: accionString,
        } : a)
      }));
      setEditandoAlertaId(null);
    } else {
      setData(prev => ({
        ...prev,
        alertas: [...(prev.alertas || []), { 
          nombre: nuevaAlerta.nombre,
          curso: nuevaAlerta.curso,
          asistenciaMes: nuevaAlerta.asistenciaMes,
          asistenciaAcum: nuevaAlerta.asistenciaAcum,
          asistenciaAcumAnterior: nuevaAlerta.asistenciaAcumAnterior,
          accion: accionString,
          id: Date.now() 
        }]
      }));
    }
    
    setNuevaAlerta({
      nombre: '',
      curso: '',
      asistenciaMes: '',
      asistenciaAcum: '',
      asistenciaAcumAnterior: '',
      acciones: [],
      otraAccion: ''
    });
  };

  const handleRemoveAlerta = (id) => {
    setData(prev => ({
      ...prev,
      alertas: (prev.alertas || []).filter(a => a.id !== id)
    }));
  };

  const clearData = () => {
    if (window.confirm('¿Está seguro de querer limpiar todos los datos? Esto no borrará el mes, pero sí todo su contenido.')) {
      setData({ ...defaultData, periodo: data.periodo });
    }
  };

  const printReport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary)' }} />
          <h2 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Sistema Inspectoría CEIA</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{loadingMsg}</p>
          <div className="loading-bar">
            <div className="loading-bar-fill"></div>
          </div>
        </div>
      </div>
    );
  }

  if (configError === 'DATABASE_MISSING') {
    return (
      <div className="loading-screen">
        <div className="card animate-fade-in" style={{ maxWidth: '600px', textAlign: 'center', padding: '3rem' }}>
          <AlertTriangle size={64} className="status-yellow" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '1.75rem' }}>Configuración Necesaria</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
            La base de datos Firestore aún no ha sido creada en tu proyecto de Firebase.<br/>
            Para activar la sincronización en la nube, sigue estos pasos:
          </p>
          <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
            <ol style={{ paddingLeft: '1.5rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>Ve a la <a href="https://console.firebase.google.com/project/inspectoria-ceia-2026/firestore" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Consola de Firebase</a>.</li>
              <li style={{ marginBottom: '0.5rem' }}>Haz clic en <strong>"Crear base de datos"</strong>.</li>
              <li style={{ marginBottom: '0.5rem' }}>Selecciona el modo <strong>"Prueba"</strong> (o Producción si prefieres).</li>
              <li>Elige una ubicación (ej: <code>us-east1</code>) y haz clic en crear.</li>
            </ol>
          </div>
          <button className="primary" onClick={() => setConfigError(null)}>
            Trabajar en Modo Local mientras tanto
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <datalist id="nombres-list">
        {uniqueNombres.map(n => <option key={n} value={n} />)}
      </datalist>
      <datalist id="cursos-list">
        {uniqueCursos.map(c => <option key={c} value={c} />)}
      </datalist>
      {offlineMode && (
        <div className="offline-banner no-print">
          <Info size={16} />
          <span><strong>Modo Offline:</strong> Los datos se guardan solo en esta sesión. Conecte Firebase para sincronización permanente.</span>
        </div>
      )}
      <header className="no-print">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <div className="navbar-logo">CI</div>
            <div>
              <div className="navbar-title">Inspectoría General CEIA</div>
              <div className="navbar-subtitle">Gestión de Eficiencia Interna y Matrícula</div>
            </div>
          </div>

          <div className="navbar-actions">
            {currentId && !offlineMode && (
              <div className="no-print" style={{
                fontSize: '0.82rem',
                color: saveStatus === 'saving' ? 'var(--text-muted)' : (saveStatus === 'error' ? 'var(--danger)' : 'var(--success)'),
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                opacity: saveStatus === 'saved' ? 0.8 : 1,
                fontWeight: 500
              }}>
                {saveStatus === 'saving' ? <><RefreshCw size={13} className="animate-spin" /> Guardando...</> :
                 saveStatus === 'error' ? <><AlertTriangle size={13} /> Error</> :
                 <><CheckCircle size={13} /> Guardado</>}
              </div>
            )}
            <span className={`status-pill no-print ${offlineMode ? 'offline' : 'online'}`}>
              {offlineMode
                ? <><CloudOff size={13} /> Modo Local</>
                : <><Cloud size={13} /> Sincronizado</>}
            </span>
            <select
              value={currentId || ''}
              onChange={(e) => handleSelectReporte(e.target.value)}
              style={{ width: '170px', padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
              disabled={!currentId}
            >
              {reportesList.length === 0 && <option value="">Sin reportes</option>}
              {reportesList.map(r => (
                <option key={r.id} value={r.id}>{r.periodo}</option>
              ))}
            </select>
            <button className="primary" onClick={handleCreateNew}>
              <Plus size={17} /> Nuevo Mes
            </button>
          </div>
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
        <button 
          className={`tab ${activeTab === 'expediente' ? 'active' : ''}`}
          onClick={() => setActiveTab('expediente')}
          disabled={!currentId}
        >
          <User size={18} /> Expediente Alumno
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
          <div className="subtab-nav no-print">
            <button
              className={`subtab-btn ${subTab === 'resumen' ? 'active' : ''}`}
              onClick={() => setSubTab('resumen')}
            >
              <span className="subtab-icon" style={{ background: '#e8edff', color: '#3b5bdb' }}>📊</span>
              <span className="subtab-label">Resumen</span>
            </button>
            <button
              className={`subtab-btn ${subTab === 'matricula' ? 'active' : ''}`}
              onClick={() => setSubTab('matricula')}
            >
              <span className="subtab-icon" style={{ background: '#e6faf4', color: '#12b886' }}>🏢</span>
              <span className="subtab-label">Matrícula</span>
            </button>
            <button
              className={`subtab-btn ${subTab === 'alertas' ? 'active' : ''}`}
              onClick={() => setSubTab('alertas')}
            >
              <span className="subtab-icon" style={{ background: '#fff4e6', color: '#fd7e14' }}>⚠️</span>
              <span className="subtab-label">Alertas</span>
            </button>
            <button
              className={`subtab-btn ${subTab === 'licencias' ? 'active' : ''}`}
              onClick={() => setSubTab('licencias')}
            >
              <span className="subtab-icon" style={{ background: '#fff5f5', color: '#f03e3e' }}>🩺</span>
              <span className="subtab-label">Licencias</span>
            </button>
          </div>

          {subTab === 'resumen' && (
            <div className="grid-2 animate-fade-in">
              <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Alumnos en Riesgo</h3>
                <div style={{ fontSize: '4rem', fontWeight: 'bold', color: (data.alertas||[]).length > 0 ? 'var(--red)' : 'var(--green)', lineHeight: 1 }}>
                  {(data.alertas||[]).length}
                </div>
                <p style={{ marginTop: '1rem' }}>Estudiantes en Alerta Temprana</p>
                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {(data.alertas||[]).filter(a => a.accion === 'Sin acción').length} sin acción tomada
                </div>
                <button className="primary" style={{ marginTop: '1.5rem' }} onClick={() => setSubTab('alertas')}>Gestionar Alertas</button>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Licencias este Mes</h3>
                <div style={{ fontSize: '4rem', fontWeight: 'bold', color: 'var(--primary)', lineHeight: 1 }}>
                  {(data.licencias||[]).length}
                </div>
                <p style={{ marginTop: '1rem' }}>Casos justificados en expediente</p>
                <button className="secondary" style={{ marginTop: '1.5rem' }} onClick={() => setSubTab('licencias')}>Ver Licencias</button>
              </div>
            </div>
          )}

          {subTab === 'matricula' && (
            <div className="animate-fade-in">
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
                <label>Matrícula Inicial del Mes (Base)</label>
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
                  disabled
                  title="Calculado automáticamente desde el Expediente de Licencias Médicas"
                  style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-muted)' }}
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
        </div>
      )}

      {subTab === 'licencias' && (
        <div className="animate-fade-in">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ marginBottom: '0.25rem' }}>Expediente de Licencias Médicas</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  Total: {(data.licencias || []).length} registros justificados.
                </p>
              </div>
              <button className="primary" onClick={() => setShowLicenciaModal(true)}>+ Agregar Licencia</button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                placeholder="🔍 Buscar alumno por nombre..." 
                value={searchTermLicencias}
                onChange={e => setSearchTermLicencias(e.target.value)}
                style={{ width: '100%', maxWidth: '400px' }}
              />
            </div>

            {showLicenciaModal && (
              <div className="modal-overlay">
                <div className="modal-card animate-fade-in" style={{ maxWidth: '500px' }}>
                  <h3 style={{ marginBottom: '1.5rem' }}>Nueva Licencia Médica</h3>
                  <form onSubmit={(e) => { handleAddLicencia(e); setShowLicenciaModal(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Nombre Estudiante</label>
                      <input required type="text" list="nombres-list" value={nuevaLicencia.nombre} onChange={e => setNuevaLicencia({...nuevaLicencia, nombre: e.target.value})} />
                    </div>
                    <div className="grid-2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Curso</label>
                        <select required value={nuevaLicencia.curso} onChange={e => setNuevaLicencia({...nuevaLicencia, curso: e.target.value})}>
                          <option value="">Seleccione...</option>
                          {CURSOS_OFICIALES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Días Justifica</label>
                        <input required type="number" min="1" placeholder="Ej: 3" value={nuevaLicencia.diasJustificados} onChange={e => setNuevaLicencia({...nuevaLicencia, diasJustificados: e.target.value})} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                      <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setShowLicenciaModal(false)}>Cancelar</button>
                      <button type="submit" className="primary" style={{ flex: 1 }}>Guardar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {(data.licencias || []).length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Curso</th>
                      <th>Días Justificados</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.licencias || [])
                      .filter(l => l.nombre.toLowerCase().includes(searchTermLicencias.toLowerCase()))
                      .map(l => (
                      <tr key={l.id} style={{ opacity: l.retirado ? 0.5 : 1, background: l.retirado ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                        <td>
                          {l.nombre}
                          {l.retirado && <span style={{ marginLeft: '0.5rem', color: 'var(--red)', fontSize: '0.75rem', fontWeight: 'bold' }}>(RETIRADO)</span>}
                        </td>
                        <td>{l.curso || '-'}</td>
                        <td>{l.diasJustificados} días</td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="danger" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleRemoveLicencia(l.id)}
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
              <p style={{ color: 'var(--text-muted)' }}>No hay licencias registradas en este periodo.</p>
            )}
          </div>
        </div>
      )}

      {subTab === 'alertas' && (
        <div className="animate-fade-in">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ marginBottom: '0.25rem' }}>Alerta Temprana de Repitencia</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  Estudiantes bajo umbral de asistencia (Meta 14).
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button 
                  className={filterCriticos ? "danger" : "secondary"} 
                  onClick={() => setFilterCriticos(!filterCriticos)}
                >
                  <AlertTriangle size={18} /> {filterCriticos ? 'Mostrando Críticos (<50%)' : 'Filtrar Casos Críticos'}
                </button>
                <button className="primary" onClick={(e) => {
                  if (e && e.clientY) {
                    setModalPosition(Math.min(e.clientY - 50, window.innerHeight - 500));
                  } else {
                    setModalPosition(null);
                  }
                  setShowAlertaModal(true);
                }}>+ Agregar Alerta</button>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                placeholder="🔍 Buscar alumno por nombre o curso (ej: 7Y8)..." 
                value={searchTermAlertas}
                onChange={e => setSearchTermAlertas(e.target.value)}
                style={{ width: '100%', maxWidth: '400px' }}
              />
            </div>

            {(showAlertaModal || editandoAlertaId) && (
              <div className="modal-overlay" style={{ alignItems: modalPosition !== null ? 'flex-start' : 'center', paddingTop: modalPosition !== null ? `${Math.max(20, modalPosition)}px` : '0' }}>
                <div className="modal-card animate-fade-in" style={{ maxWidth: '600px' }}>
                  <h3 style={{ marginBottom: '1.5rem' }}>{editandoAlertaId ? 'Editar Alerta' : 'Nueva Alerta'}</h3>
                  <form onSubmit={(e) => { handleAddAlerta(e); setShowAlertaModal(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Nombre Estudiante</label>
                      <input required type="text" list="nombres-list" value={nuevaAlerta.nombre} onChange={e => setNuevaAlerta({...nuevaAlerta, nombre: e.target.value})} />
                    </div>
                    <div className="grid-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Curso</label>
                        <select required value={nuevaAlerta.curso} onChange={e => setNuevaAlerta({...nuevaAlerta, curso: e.target.value})}>
                          <option value="">Seleccione...</option>
                          {CURSOS_OFICIALES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>% Mes</label>
                        <input required type="number" value={nuevaAlerta.asistenciaMes} onChange={e => {
                          const mes = e.target.value;
                          let acum = nuevaAlerta.asistenciaAcum;
                          if (mes !== '' && nuevaAlerta.asistenciaAcumAnterior !== '' && nuevaAlerta.asistenciaAcumAnterior !== undefined) {
                            acum = Math.round((Number(nuevaAlerta.asistenciaAcumAnterior) + Number(mes)) / 2);
                          }
                          setNuevaAlerta({...nuevaAlerta, asistenciaMes: mes, asistenciaAcum: acum});
                        }} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>% Acum.</label>
                        <input required type="number" value={nuevaAlerta.asistenciaAcum} onChange={e => setNuevaAlerta({...nuevaAlerta, asistenciaAcum: e.target.value})} />
                      </div>
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Acción Realizada</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {['Derivado a Dupla Psicosocial', 'Citación de apoderado/adulto', 'Entrevista Personal', 'Visita Domiciliaria'].map(op => {
                          const isSelected = nuevaAlerta.acciones.includes(op);
                          return (
                            <label key={op} style={{ 
                              display: 'inline-flex', alignItems: 'center', padding: '0.4rem 0.8rem', 
                              background: isSelected ? 'var(--primary-glow)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                              borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem',
                              color: isSelected ? '#fff' : 'var(--text-muted)'
                            }}>
                              <input 
                                type="checkbox" 
                                style={{ display: 'none' }}
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNuevaAlerta({...nuevaAlerta, acciones: [...nuevaAlerta.acciones, op]});
                                  } else {
                                    setNuevaAlerta({...nuevaAlerta, acciones: nuevaAlerta.acciones.filter(a => a !== op)});
                                  }
                                }}
                              /> {op}
                            </label>
                          );
                        })}
                        
                        <label style={{ 
                          display: 'inline-flex', alignItems: 'center', padding: '0.4rem 0.8rem', 
                          background: nuevaAlerta.acciones.includes('Otra') ? 'var(--primary-glow)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${nuevaAlerta.acciones.includes('Otra') ? 'var(--primary)' : 'var(--border)'}`,
                          borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem',
                          color: nuevaAlerta.acciones.includes('Otra') ? '#fff' : 'var(--text-muted)'
                        }}>
                          <input 
                            type="checkbox" 
                            style={{ display: 'none' }}
                            checked={nuevaAlerta.acciones.includes('Otra')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNuevaAlerta({...nuevaAlerta, acciones: [...nuevaAlerta.acciones, 'Otra']});
                              } else {
                                setNuevaAlerta({...nuevaAlerta, acciones: nuevaAlerta.acciones.filter(a => a !== 'Otra'), otraAccion: ''});
                              }
                            }}
                          /> Otra
                        </label>
      
                        {nuevaAlerta.acciones.includes('Otra') && (
                          <input 
                            type="text" 
                            value={nuevaAlerta.otraAccion} 
                            onChange={e => setNuevaAlerta({...nuevaAlerta, otraAccion: e.target.value})}
                            style={{ 
                              padding: '0.4rem 0.8rem', fontSize: '0.85rem', width: '200px', 
                              borderRadius: '20px', background: 'rgba(15,23,42,0.6)', margin: 0 
                            }}
                            placeholder="Especifique cuál..."
                          />
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                      <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => {
                        setEditandoAlertaId(null);
                        setShowAlertaModal(false);
                        setNuevaAlerta({ nombre: '', curso: '', asistenciaMes: '', asistenciaAcum: '', asistenciaAcumAnterior: '', acciones: [], otraAccion: '' });
                      }}>Cancelar</button>
                      <button type="submit" className="primary" style={{ flex: 1 }}>{editandoAlertaId ? 'Actualizar' : 'Guardar'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {(data.alertas || []).length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Curso</th>
                      <th>% Mes</th>
                      <th>% Acum</th>
                      <th>Acción</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.alertas || [])
                      .filter(a => {
                        const searchLower = searchTermAlertas.toLowerCase();
                        const matchesSearch = a.nombre.toLowerCase().includes(searchLower) || (a.curso && a.curso.toLowerCase().includes(searchLower));
                        const matchesCritico = filterCriticos ? Number(a.asistenciaAcum) < 50 : true;
                        return matchesSearch && matchesCritico;
                      })
                      .map(a => (
                      <tr key={a.id} style={{ opacity: a.retirado ? 0.5 : 1, background: a.retirado ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                        <td>
                          {a.nombre}
                          {a.retirado && <span style={{ marginLeft: '0.5rem', color: 'var(--red)', fontSize: '0.75rem', fontWeight: 'bold' }}>(RETIRADO {a.fechaRetiro ? `- ${a.fechaRetiro}` : ''})</span>}
                        </td>
                        <td>{a.curso || '-'}</td>
                        <td>{a.asistenciaMes}%</td>
                        <td>{a.asistenciaAcum}%</td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: a.accion === 'Sin acción' ? 'rgba(239, 68, 68, 0.15)' : 
                                        a.accion.includes('Citación') ? 'rgba(245, 158, 11, 0.15)' : 
                                        'rgba(16, 185, 129, 0.15)',
                            color: a.accion === 'Sin acción' ? 'var(--red)' : 
                                   a.accion.includes('Citación') ? 'var(--warning)' : 
                                   'var(--green)',
                            border: `1px solid ${a.accion === 'Sin acción' ? 'rgba(239, 68, 68, 0.3)' : 
                                               a.accion.includes('Citación') ? 'rgba(245, 158, 11, 0.3)' : 
                                               'rgba(16, 185, 129, 0.3)'}`
                          }}>
                            {a.accion}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="secondary" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', marginRight: '0.5rem' }}
                            onClick={(e) => handleEditAlerta(a, e)}
                          >
                            Editar
                          </button>
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
        </div>
      )}

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
                <div className="metric-title">Matrícula Final (Mes)</div>
                <div className={`metric-value ${((Number(data.matriculaTotal) || 0) + (Number(data.nuevasIncorporaciones) || 0) - (Number(data.retirosEfectivos) || 0)) >= 136 ? 'status-green' : 'status-red'}`}>
                  {(Number(data.matriculaTotal) || 0) + (Number(data.nuevasIncorporaciones) || 0) - (Number(data.retirosEfectivos) || 0)}
                </div>
                <div className="metric-meta">
                  Meta ≥ 136 | 
                  {((Number(data.matriculaTotal) || 0) + (Number(data.nuevasIncorporaciones) || 0) - (Number(data.retirosEfectivos) || 0)) >= 136 ? 
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
                      <th>Curso</th>
                      <th>% Asistencia Mes</th>
                      <th>% Asistencia Acumulada</th>
                      <th>Acción Realizada (Derivación)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.alertas.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500 }}>{a.nombre}</td>
                        <td>{a.curso || '-'}</td>
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
            <h2>5. Expediente de Licencias Médicas</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Registro detallado de justificaciones por salud. Total: {data.casosLicencias} casos.
            </p>
            
            {(data.licencias || []).length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre del Estudiante</th>
                      <th>Curso</th>
                      <th>Días Justificados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.licencias || []).map(l => (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 500 }}>{l.nombre}</td>
                        <td>{l.curso || '-'}</td>
                        <td>{l.diasJustificados}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                No se registraron licencias médicas en este periodo.
              </p>
            )}
          </div>

          <div className="card">
            <h2>6. Observaciones y Requerimientos</h2>
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

      {activeTab === 'expediente' && (
        <div className="animate-fade-in" id="printable-report">
          <div className="no-print card" style={{ marginBottom: '2rem' }}>
            <h2>Buscar Expediente de Estudiante</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Busca un alumno por nombre para generar su reporte histórico de alertas y licencias.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                list="nombres-list"
                placeholder="Nombre del estudiante..." 
                value={selectedStudentForReport}
                onChange={e => setSelectedStudentForReport(e.target.value)}
                style={{ flex: 1, minWidth: '250px' }}
              />
              {selectedStudentForReport && (
                <button className="primary" onClick={printReport}>
                  <Printer size={18} /> Imprimir Expediente
                </button>
              )}
            </div>
          </div>

          {periodosAgrupados.length > 0 && selectedStudentForReport && (
            <div className="card" style={{ background: '#fff', color: '#000' }}>
              <div style={{ textAlign: 'center', marginBottom: '3rem', borderBottom: '2px solid #eee', paddingBottom: '1.5rem' }}>
                <h1 style={{ color: '#000', marginBottom: '0.5rem', fontSize: '2rem' }}>EXPEDIENTE DE ACTUACIONES</h1>
                <h2 style={{ color: '#1e293b', fontSize: '1.5rem', fontWeight: 600 }}>ALUMNO(A): {selectedStudentForReport.toUpperCase()}</h2>
                <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Inspectoría General - CEIA Juanita Zúñiga Fuentes</p>
              </div>

              {periodosAgrupados.map((p, index) => (
                <div key={index} style={{ marginBottom: '2.5rem', borderLeft: '4px solid #3b82f6', paddingLeft: '1.5rem' }}>
                  <h3 style={{ color: '#0f172a', fontSize: '1.25rem', marginBottom: '1rem', display: 'inline-block', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.25rem' }}>
                    Mes de Registro: {p.periodo.toUpperCase()}
                  </h3>

                  {p.alertas.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ color: '#334155', marginBottom: '0.5rem', fontSize: '1rem' }}>⚠️ Acciones y Alertas de Repitencia</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', color: '#0f172a', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ border: '1px solid #cbd5e1', padding: '10px', textAlign: 'left', width: '20%' }}>Curso</th>
                            <th style={{ border: '1px solid #cbd5e1', padding: '10px', textAlign: 'center', width: '15%' }}>% Asistencia</th>
                            <th style={{ border: '1px solid #cbd5e1', padding: '10px', textAlign: 'left' }}>Acción / Medida Tomada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.alertas.map((a, i) => (
                            <tr key={i}>
                              <td style={{ border: '1px solid #cbd5e1', padding: '10px' }}>{a.curso}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '10px', textAlign: 'center' }}>{a.asistenciaAcum}%</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '10px', fontWeight: 600 }}>{a.accion}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {p.licencias.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ color: '#334155', marginBottom: '0.5rem', fontSize: '1rem' }}>🩺 Justificaciones (Licencias Médicas)</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', color: '#0f172a', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ border: '1px solid #cbd5e1', padding: '10px', textAlign: 'left', width: '20%' }}>Curso</th>
                            <th style={{ border: '1px solid #cbd5e1', padding: '10px', textAlign: 'left' }}>Días Justificados</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.licencias.map((l, i) => (
                            <tr key={i}>
                              <td style={{ border: '1px solid #cbd5e1', padding: '10px' }}>{l.curso}</td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '10px', fontWeight: 600 }}>{l.diasJustificados} días</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              <div style={{ marginTop: '4rem', display: 'flex', justifyContent: 'space-around', color: '#0f172a' }}>
                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={{ borderBottom: '1px solid #0f172a', height: '40px' }}></div>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Firma Inspector(a) General</p>
                </div>
                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={{ borderBottom: '1px solid #0f172a', height: '40px' }}></div>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Firma Director(a) / Timbre</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
