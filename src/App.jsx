import React, { useState, useEffect, useMemo } from 'react';
import { 
  Save, FileText, TrendingUp, TrendingDown, Minus, 
  UserPlus, UserMinus, AlertTriangle, CheckCircle, Info, Printer, Loader2, Plus, Calendar, Cloud, CloudOff, RefreshCw, User,
  Search, X, Pencil, Trash2, Stethoscope, ClipboardCheck
} from 'lucide-react';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import alumnosData from '../alumnos_data.json';
import './index.css';

const CURSOS_OFICIALES = [
  '7Y8', '1Y2 HC', '3Y4 HC', '1Y2 ELE', '3 ELEC', 
  '4 ELEC', '1Y2 PAR', '3 PAR', '4 PAR'
];

// Helper para extraer el mes para ordenamiento
const getMonthIndex = (periodo) => {
  if (!periodo) return -1;
  const p = periodo.toLowerCase();
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  for (let i = 0; i < meses.length; i++) {
    if (p.includes(meses[i])) return i;
  }
  return -1;
};

// Helper para extraer el año para ordenamiento
const getYear = (periodo) => {
  if (!periodo) return 0;
  const match = periodo.match(/\d{4}/);
  return match ? parseInt(match[0]) : 2026; // Default al año actual si no se especifica
};

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
  const [currentId, setCurrentId] = useState(() => localStorage.getItem('lastSelectedReportId'));
  const [data, setData] = useState(defaultData);
  const [searchTermAlertas, setSearchTermAlertas] = useState('');
  const [filterCriticos, setFilterCriticos] = useState(false);
  const [reportFilterUnder50, setReportFilterUnder50] = useState(false);
  const [reportFilterDerivacion, setReportFilterDerivacion] = useState(false);
  const [expedienteFilterUnder50, setExpedienteFilterUnder50] = useState(false);
  const [expedienteFilterDerivacion, setExpedienteFilterDerivacion] = useState(false);
  const [searchTermLicencias, setSearchTermLicencias] = useState('');
  const [filterCursoLicencias, setFilterCursoLicencias] = useState('');
  const [filterTipoLicencias, setFilterTipoLicencias] = useState('');
  const [licenciaAEliminar, setLicenciaAEliminar] = useState(null);
  const [showAlertaModal, setShowAlertaModal] = useState(false);
  const [showLicenciaModal, setShowLicenciaModal] = useState(false);
  const [modalPosition, setModalPosition] = useState(null);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState('');
  const [inputManualLicencia, setInputManualLicencia] = useState(false);
  const [inputManualAlerta, setInputManualAlerta] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState(null); // { rows: [], unmatched: [] }
  const [importStep, setImportStep] = useState('paste'); // 'paste' | 'preview'

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

  const retiredStudentsMap = useMemo(() => {
    const map = new Map();
    if (!alumnosData) return map;

    // 1. Un alumno puede aparecer en mas de un curso (ej: traslado de especialidad).
    //    Si esta ACTIVO en cualquier curso, no debe marcarse como retirado.
    const activos = new Set();
    alumnosData.forEach(c => {
      if (c.alumnos) {
        c.alumnos.forEach(a => {
          if (a.nombre && !a.retirado) activos.add(a.nombre);
        });
      }
    });

    // 2. Solo se marca retirado quien NO esta activo en ningun curso.
    //    Si tiene retiros en varios cursos, vale el MAS RECIENTE: esa es la
    //    fecha en que efectivamente dejo el establecimiento.
    const aFecha = (f) => {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(f || ''));
      return m ? new Date(`${m[3]}-${m[2]}-${m[1]}`).getTime() : 0;
    };
    alumnosData.forEach(c => {
      if (c.alumnos) {
        c.alumnos.forEach(a => {
          if (a.retirado && a.nombre && !activos.has(a.nombre)) {
            if (!map.has(a.nombre) || aFecha(a.fechaRetiro) > aFecha(map.get(a.nombre))) {
              map.set(a.nombre, a.fechaRetiro);
            }
          }
        });
      }
    });
    return map;
  }, []);

  const matriculaFinal = useMemo(() => {
    return (Number(data.matriculaTotal) || 0) + (Number(data.nuevasIncorporaciones) || 0) - (Number(data.retirosEfectivos) || 0);
  }, [data.matriculaTotal, data.nuevasIncorporaciones, data.retirosEfectivos]);

  const suggestedAnalisis = useMemo(() => {
    const inc = Number(data.nuevasIncorporaciones) || 0;
    const ret = Number(data.retirosEfectivos) || 0;
    const diff = inc - ret;
    let text = `Matrícula inicial de ${data.matriculaTotal}. `;
    
    if (inc === 0 && ret === 0) {
      text += `No se registran variaciones en la matrícula durante el periodo. Se mantiene en ${matriculaFinal} estudiantes.`;
    } else if (diff > 0) {
      text += `Se observa un crecimiento de ${diff} alumnos (${inc} incorporaciones vs ${ret} retiros), finalizando con ${matriculaFinal} estudiantes. Matrícula en alza.`;
    } else if (diff < 0) {
      text += `Se registra una disminución de ${Math.abs(diff)} alumnos (${inc} incorporaciones vs ${ret} retiros), finalizando con ${matriculaFinal} estudiantes. Se observa fuga de matrícula.`;
    } else {
      text += `La matrícula se mantiene estable en ${matriculaFinal} alumnos (las incorporaciones compensan los retiros).`;
    }
    return text;
  }, [data.matriculaTotal, data.nuevasIncorporaciones, data.retirosEfectivos, matriculaFinal]);

  // Automatizar cálculos de Riesgo de Repitencia y Casos de Licencias
  useEffect(() => {
    if (loading) return;
    
    const totalMatricula = (Number(data.matriculaTotal) || 0) + (Number(data.nuevasIncorporaciones) || 0) - (Number(data.retirosEfectivos) || 0);
    const newRiesgo = totalMatricula > 0 ? Math.round(((data.alertas || []).length / totalMatricula) * 100) : 0;
    const newCasosLicencias = (data.licencias || []).length;
    
    if (newRiesgo !== data.riesgoRepitencia || newCasosLicencias !== data.casosLicencias) {
      setData(prev => ({
        ...prev,
        riesgoRepitencia: newRiesgo,
        casosLicencias: newCasosLicencias
      }));
    }
  }, [data.alertas, data.licencias, data.matriculaTotal, data.nuevasIncorporaciones, data.retirosEfectivos, loading]);

  // Cargar desde Firebase en tiempo real con timeout de seguridad
  // Función para reintentar la conexión
  const retryConnection = () => {
    setLoading(true);
    setLoadingMsg('Reintentando conexión con Firebase...');
    setOfflineMode(false);
    setConfigError(null);
  };

  const loadData = () => {
    let unsubscribe = () => {};
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn("⏱️ Timeout: Firestore no respondió en 10s. Iniciando en modo offline.");
        setOfflineMode(true);
        setLoading(false);
      }
    }, 10000);

    const msgTimer = setTimeout(() => {
      if (!resolved) setLoadingMsg('La conexión está tardando más de lo habitual...');
    }, 3000);

    try {
      unsubscribe = onSnapshot(collection(db, 'reportes'), (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...defaultData, id: docSnap.id, ...docSnap.data() });
        });
        
        list.sort((a, b) => {
          const yearA = getYear(a.periodo || a.id);
          const yearB = getYear(b.periodo || b.id);
          if (yearA !== yearB) return yearB - yearA;
          return getMonthIndex(b.periodo || b.id) - getMonthIndex(a.periodo || a.id);
        });
        
        setReportesList(list);
        setOfflineMode(false);
        setConfigError(null);
        setLoading(false);

        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          clearTimeout(msgTimer);
        }

        setCurrentId(current => {
          if (!current && list.length > 0) {
            setData(list[0]);
            return list[0].id;
          } else if (current) {
            const selected = list.find(r => r.id === current);
            if (selected) setData(selected);
          }
          return current;
        });
      }, (error) => {
        console.error("Error al cargar datos desde Firebase:", error);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          clearTimeout(msgTimer);
        }
        
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

    return unsubscribe;
  };

  useEffect(() => {
    const unsubscribe = loadData();
    return () => unsubscribe();
  }, []);

  // Función para guardar explícitamente (Sobreescritura Total)
  const saveToFirebase = async (dataToSave, id) => {
    if (!id) return;
    
    setSaveStatus('saving');
    try {
      const docRef = doc(db, 'reportes', id);
      
      const sanitizedData = {};
      Object.keys(defaultData).forEach(key => {
        sanitizedData[key] = dataToSave[key] !== undefined ? dataToSave[key] : defaultData[key];
      });

      await setDoc(docRef, sanitizedData);
      setSaveStatus('saved');
      setOfflineMode(false);
    } catch (err) {
      console.error("Error al guardar en Firebase:", err);
      setSaveStatus('error');
    }
  };

  // Guardar en Firebase cuando hay cambios (con debounce)
  useEffect(() => {
    if (loading || !currentId || offlineMode) return;
    
    const timer = setTimeout(() => {
      saveToFirebase(data, currentId);
    }, 800); // Reducido a 800ms para mayor agilidad
    
    return () => clearTimeout(timer);
  }, [data, loading, currentId, offlineMode]);

  // Forzar guardado antes de salir o cambiar de pestaña
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (saveStatus === 'saving') {
        // Intentar guardar inmediatamente (aunque en sync es difícil con Firestore)
        saveToFirebase(data, currentId);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [data, currentId, saveStatus]);

  const handleSelectReporte = (id) => {
    const found = reportesList.find(r => r.id === id);
    if (found) {
      setCurrentId(id);
      localStorage.setItem('lastSelectedReportId', id);
      setData({ ...defaultData, ...found });
      setActiveTab('ingreso');
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
    // Guardar inmediatamente el nuevo mes
    saveToFirebase(newData, id);
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
    
    // 1. Agregar desde el JSON oficial
    alumnosData.forEach(c => {
      c.alumnos.forEach(a => {
        if (a.nombre) nombres.add(a.nombre);
      });
    });

    // 2. Agregar desde reportes existentes (por si hay nombres nuevos)
    reportesList.forEach(r => {
      (r.alertas || []).forEach(a => { if (a.nombre) nombres.add(a.nombre); });
      (r.licencias || []).forEach(l => { if (l.nombre) nombres.add(l.nombre); });
    });

    // 3. Agregar desde el estado actual
    (data.alertas || []).forEach(a => { if (a.nombre) nombres.add(a.nombre); });
    (data.licencias || []).forEach(l => { if (l.nombre) nombres.add(l.nombre); });
    
    return Array.from(nombres).sort();
  }, [reportesList, data.alertas, data.licencias]);

  const alumnosPorCurso = useMemo(() => {
    const map = new Map();
    const addStudent = (nombre, curso) => {
      if (!nombre || !curso) return;
      const c = String(curso).trim();
      const n = String(nombre).trim();
      if (!map.has(c)) map.set(c, new Set());
      map.get(c).add(n);
    };

    // 1. Cargar desde JSON oficial
    alumnosData.forEach(c => {
      c.alumnos.forEach(a => addStudent(a.nombre, c.curso));
    });

    // 2. Cargar desde reportes
    reportesList.forEach(r => {
      (r.alertas || []).forEach(a => addStudent(a.nombre, a.curso));
      (r.licencias || []).forEach(l => addStudent(l.nombre, l.curso));
    });
    (data.alertas || []).forEach(a => addStudent(a.nombre, a.curso));
    (data.licencias || []).forEach(l => addStudent(l.nombre, l.curso));

    const result = {};
    map.forEach((nombresSet, curso) => {
      result[curso] = Array.from(nombresSet).sort();
    });
    return result;
  }, [reportesList, data.alertas, data.licencias]);

  const uniqueCursos = CURSOS_OFICIALES;

  const [nuevaLicencia, setNuevaLicencia] = useState({
    nombre: '',
    curso: '',
    tipoCertificado: 'licencia',
    diasJustificados: ''
  });
  const [editandoLicenciaId, setEditandoLicenciaId] = useState(null);

  const handleAddLicencia = (e) => {
    e.preventDefault();
    if (!nuevaLicencia.nombre) return;
    
    if (editandoLicenciaId) {
      // Modo edición: actualizar licencia existente
      setData(prev => ({
        ...prev,
        licencias: (prev.licencias || []).map(l => 
          l.id === editandoLicenciaId ? { ...l, ...nuevaLicencia } : l
        )
      }));
      setEditandoLicenciaId(null);
    } else {
      // Modo nuevo: agregar licencia
      setData(prev => {
        const newLicencias = [...(prev.licencias || []), { ...nuevaLicencia, id: Date.now() }];
        return {
          ...prev,
          licencias: newLicencias,
          casosLicencias: newLicencias.length
        };
      });
    }
    
    setNuevaLicencia({ nombre: '', curso: '', tipoCertificado: 'licencia', diasJustificados: '' });
    setInputManualLicencia(false);
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
    if (window.confirm('¿Está seguro de eliminar este estudiante de la lista de alertas?')) {
      setData(prev => {
        const newAlertas = (prev.alertas || []).filter(a => a.id !== id);
        const totalMatricula = (Number(prev.matriculaTotal) || 0) + (Number(prev.nuevasIncorporaciones) || 0) - (Number(prev.retirosEfectivos) || 0);
        return {
          ...prev,
          alertas: newAlertas,
          riesgoRepitencia: totalMatricula > 0 ? Math.round((newAlertas.length / totalMatricula) * 100) : 0
        };
      });
    }
  };

  // =====================================================
  // IMPORTACIÓN MASIVA DE ASISTENCIAS
  // =====================================================

  // Limpia tildes y normaliza a mayúsculas para comparar
  const normalizeStr = (s) =>
    String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/\s+/g, ' ').trim();

  // Coincidencia flexible: chequea si todos los tokens del candidato
  // están contenidos en el nombre de la nómina (permite orden inverso)
  const fuzzyMatch = (nominaName, candidateName) => {
    const a = normalizeStr(nominaName);
    const b = normalizeStr(candidateName);
    if (a === b) return true;
    const tokensB = b.split(' ');
    // Todos los tokens del candidato deben aparecer en el nombre de nómina
    return tokensB.every(t => t.length > 2 && a.includes(t));
  };

  const handleParseImport = () => {
    const lines = importText.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return;

    // Detectar separador: TAB o punto y coma
    const sep = lines[0].includes('\t') ? '\t' : ';';

    // Intentar detectar si la primera línea es encabezado
    const firstCells = lines[0].split(sep);
    const hasHeader = isNaN(firstCells[firstCells.length - 1].trim().replace('%',''));
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const currentAlertas = data.alertas || [];
    const matched = [];
    const unmatched = [];

    dataLines.forEach(line => {
      const cells = line.split(sep).map(c => c.trim().replace('%', ''));
      if (cells.length < 3) return; // necesita al menos curso, nombre, porcentaje

      // Intentar detectar formato: puede ser [nombre, curso, pct] o [curso, nombre, pct]
      // Si la primera celda coincide con un curso oficial -> [curso, nombre, pct]
      // Si no, asumimos [nombre, curso, pct]
      let curso, nombre, pctStr;
      const cursoOficialNorm = CURSOS_OFICIALES.map(c => normalizeStr(c));
      if (cursoOficialNorm.includes(normalizeStr(cells[0]))) {
        [curso, nombre, pctStr] = [cells[0], cells[1], cells[2]];
      } else if (cursoOficialNorm.includes(normalizeStr(cells[1]))) {
        [nombre, curso, pctStr] = [cells[0], cells[1], cells[2]];
      } else {
        // último intento: usar la última celda como porcentaje
        nombre = cells.slice(0, -1).join(' ');
        pctStr = cells[cells.length - 1];
        curso = '';
      }

      const pct = parseFloat(pctStr);
      if (isNaN(pct) || pct < 0 || pct > 100) return;

      // Buscar alumno existente por fuzzy match de nombre
      const existing = currentAlertas.find(a => fuzzyMatch(a.nombre, nombre));

      if (existing) {
        // Calcular nuevo acumulado: si no hay anterior, el acumulado es el mes actual
        const prevValue = existing.asistenciaAcumAnterior || existing.asistenciaAcum;
        const anterior = prevValue !== '' && prevValue !== undefined ? parseFloat(prevValue) : null;
        
        const nuevoAcum = anterior !== null 
          ? Math.round((anterior + pct) / 2)
          : pct;

        matched.push({
          id: existing.id,
          nombreExistente: existing.nombre,
          nombreCSV: nombre,
          curso: curso || existing.curso,
          asistenciaMes: pct,
          asistenciaAcum: nuevoAcum,
          asistenciaAcumAnterior: anterior !== null ? anterior : pct,
        });
      } else {
        unmatched.push({ nombre, curso, pct });
      }
    });

    setImportPreview({ matched, unmatched });
    setImportStep('preview');
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    setData(prev => ({
      ...prev,
      alertas: (prev.alertas || []).map(a => {
        const row = importPreview.matched.find(r => r.id === a.id);
        if (!row) return a;
        return {
          ...a,
          asistenciaMes: row.asistenciaMes,
          asistenciaAcum: row.asistenciaAcum,
          asistenciaAcumAnterior: row.asistenciaAcumAnterior,
        };
      }),
      // Actualizar asistencia promedio automáticamente
      asistenciaPromedio: importPreview.matched.length > 0
        ? Math.round(importPreview.matched.reduce((acc, r) => acc + r.asistenciaMes, 0) / importPreview.matched.length)
        : prev.asistenciaPromedio,
    }));
    setShowImportModal(false);
    setImportText('');
    setImportPreview(null);
    setImportStep('paste');
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
        <div className="offline-banner no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Info size={16} />
            <span><strong>Modo Local:</strong> Los datos se guardan solo en esta sesión. Conecte Firebase para sincronización permanente.</span>
          </div>
          <button onClick={() => window.location.reload()} className="secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
            <RefreshCw size={12} style={{ marginRight: '4px' }} /> Reconectar
          </button>
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
            <button
              className={`subtab-btn ${subTab === 'config' ? 'active' : ''}`}
              onClick={() => setSubTab('config')}
            >
              <span className="subtab-icon" style={{ background: '#f1f3f5', color: '#495057' }}>⚙️</span>
              <span className="subtab-label">Configuración</span>
            </button>
          </div>

          {subTab === 'resumen' && (
            <div className="grid-2 animate-fade-in">
              <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Casos Críticos (&lt;50% asistencia)</h3>
                <div style={{ fontSize: '4rem', fontWeight: 'bold', color: (data.alertas||[]).filter(a => Number(a.asistenciaAcum) < 50).length > 0 ? 'var(--red)' : 'var(--green)', lineHeight: 1 }}>
                  {(data.alertas||[]).filter(a => Number(a.asistenciaAcum) < 50).length}
                </div>
                <p style={{ marginTop: '1rem' }}>Estudiantes bajo umbral crítico (Meta 14)</p>
                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {(data.alertas||[]).length} alumnos en seguimiento total
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ margin: 0 }}>Análisis de Permanencia</label>
                  <button 
                    className="secondary" 
                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={() => setData(prev => ({ ...prev, analisisPermanencia: suggestedAnalisis }))}
                    title="Generar análisis automático basado en los números de matrícula"
                  >
                    <RefreshCw size={12} /> Auto-generar
                  </button>
                </div>
                <textarea 
                  name="analisisPermanencia" 
                  value={data.analisisPermanencia} 
                  onChange={handleChange}
                  placeholder="Breve comentario sobre si la matrícula se mantiene estable o si hay fuga..."
                  style={{ minHeight: '100px' }}
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

      {subTab === 'licencias' && (() => {
        const lics = data.licencias || [];
        const esAtencion = (l) => l.tipoCertificado === 'atencion';
        const totalMedicas = lics.filter(l => !esAtencion(l)).length;
        const totalAtenciones = lics.filter(esAtencion).length;
        const totalDias = lics.reduce((s, l) => s + (Number(l.diasJustificados) || 0), 0);
        const estaRetirado = (l) => Boolean(l.retirado || retiredStudentsMap.has(l.nombre));

        const filtradas = lics.filter(l => {
          const coincideNombre = (l.nombre || '').toLowerCase().includes(searchTermLicencias.toLowerCase());
          const coincideCurso = !filterCursoLicencias || l.curso === filterCursoLicencias;
          const coincideTipo = !filterTipoLicencias ||
            (filterTipoLicencias === 'atencion' ? esAtencion(l) : !esAtencion(l));
          return coincideNombre && coincideCurso && coincideTipo;
        });

        const hayFiltros = Boolean(searchTermLicencias || filterCursoLicencias || filterTipoLicencias);
        const limpiarFiltros = () => {
          setSearchTermLicencias('');
          setFilterCursoLicencias('');
          setFilterTipoLicencias('');
        };

        const cerrarModal = () => {
          setShowLicenciaModal(false);
          setEditandoLicenciaId(null);
          setNuevaLicencia({ nombre: '', curso: '', tipoCertificado: 'licencia', diasJustificados: '' });
          setInputManualLicencia(false);
        };

        const duplicadas = nuevaLicencia.nombre
          ? lics.filter(l => l.nombre === nuevaLicencia.nombre && l.id !== editandoLicenciaId).length
          : 0;
        const alumnoRetirado = nuevaLicencia.nombre && retiredStudentsMap.has(nuevaLicencia.nombre);

        return (
        <div className="animate-fade-in">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Stethoscope size={22} style={{ color: 'var(--danger)' }} />
                  Expediente de Licencias Médicas
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  Respaldo de inasistencias justificadas · {data.periodo || 'Sin periodo asignado'}
                </p>
              </div>
              <button className="primary" onClick={() => setShowLicenciaModal(true)}>
                <Plus size={18} /> Agregar Licencia
              </button>
            </div>

            {/* Resumen del expediente */}
            <div className="grid-3" style={{ marginBottom: '1.75rem' }}>
              <div className="metric-card">
                <div className="metric-icon" style={{ background: 'var(--primary-ultra-light)', color: 'var(--primary)' }}>
                  <Stethoscope size={24} />
                </div>
                <div className="metric-value" style={{ color: 'var(--primary)' }}>{totalMedicas}</div>
                <div className="metric-title">Licencias Médicas</div>
              </div>
              <div className="metric-card">
                <div className="metric-icon" style={{ background: 'var(--accent-orange-light)', color: 'var(--accent-orange)' }}>
                  <ClipboardCheck size={24} />
                </div>
                <div className="metric-value" style={{ color: 'var(--accent-orange)' }}>{totalAtenciones}</div>
                <div className="metric-title">Cert. de Atención</div>
              </div>
              <div className="metric-card">
                <div className="metric-icon" style={{ background: 'var(--accent-green-light)', color: 'var(--accent-green)' }}>
                  <Calendar size={24} />
                </div>
                <div className="metric-value" style={{ color: 'var(--accent-green)' }}>{totalDias}</div>
                <div className="metric-title">Días Justificados</div>
              </div>
            </div>

            {/* Filtros */}
            {lics.length > 0 && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Buscar alumno por nombre..."
                    value={searchTermLicencias}
                    onChange={e => setSearchTermLicencias(e.target.value)}
                    style={{ width: '100%', paddingLeft: '2.4rem' }}
                  />
                </div>
                <select
                  value={filterCursoLicencias}
                  onChange={e => setFilterCursoLicencias(e.target.value)}
                  style={{ flex: '0 1 170px' }}
                >
                  <option value="">Todos los cursos</option>
                  {CURSOS_OFICIALES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={filterTipoLicencias}
                  onChange={e => setFilterTipoLicencias(e.target.value)}
                  style={{ flex: '0 1 190px' }}
                >
                  <option value="">Todos los tipos</option>
                  <option value="licencia">Licencia Médica</option>
                  <option value="atencion">Cert. de Atención</option>
                </select>
                {hayFiltros && (
                  <button className="secondary" onClick={limpiarFiltros} title="Limpiar filtros">
                    <X size={16} /> Limpiar
                  </button>
                )}
              </div>
            )}

            {hayFiltros && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Mostrando <strong>{filtradas.length}</strong> de {lics.length} registros
              </p>
            )}

            {/* Modal de confirmación de borrado */}
            {licenciaAEliminar && (
              <div className="modal-overlay">
                <div className="modal-card animate-fade-in" style={{ maxWidth: '440px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div className="metric-icon" style={{ width: 44, height: 44, marginBottom: 0, background: 'var(--accent-pink-light)', color: 'var(--danger)' }}>
                      <AlertTriangle size={22} />
                    </div>
                    <h3 style={{ margin: 0 }}>¿Eliminar este registro?</h3>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Se eliminará la licencia de <strong>{licenciaAEliminar.nombre}</strong>
                    {licenciaAEliminar.curso ? ` (${licenciaAEliminar.curso})` : ''}.
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    Esta acción no se puede deshacer.
                  </p>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setLicenciaAEliminar(null)}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="danger"
                      style={{ flex: 1 }}
                      onClick={() => { handleRemoveLicencia(licenciaAEliminar.id); setLicenciaAEliminar(null); }}
                    >
                      <Trash2 size={16} /> Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(showLicenciaModal || editandoLicenciaId) && (
              <div className="modal-overlay">
                <div className="modal-card animate-fade-in" style={{ maxWidth: '520px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div className="metric-icon" style={{ width: 44, height: 44, marginBottom: 0, background: 'var(--primary-ultra-light)', color: 'var(--primary)' }}>
                      <Stethoscope size={22} />
                    </div>
                    <h3 style={{ margin: 0 }}>{editandoLicenciaId ? 'Editar Licencia' : 'Nueva Licencia Médica'}</h3>
                  </div>
                  <form onSubmit={(e) => { handleAddLicencia(e); setShowLicenciaModal(false); setEditandoLicenciaId(null); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="grid-2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Curso</label>
                        <select required value={nuevaLicencia.curso} onChange={e => setNuevaLicencia({...nuevaLicencia, curso: e.target.value})}>
                          <option value="">Seleccione...</option>
                          {CURSOS_OFICIALES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Nombre Estudiante</label>
                        {!inputManualLicencia ? (
                          <select 
                            required 
                            className="form-control"
                            value={nuevaLicencia.nombre} 
                            onChange={e => {
                              if (e.target.value === '__OTRO__') {
                                setInputManualLicencia(true);
                                setNuevaLicencia({...nuevaLicencia, nombre: ''});
                              } else {
                                setNuevaLicencia({...nuevaLicencia, nombre: e.target.value});
                              }
                            }}
                            disabled={!nuevaLicencia.curso}
                          >
                            <option value="">{nuevaLicencia.curso ? "Seleccione alumno..." : "Primero seleccione curso"}</option>
                            {(nuevaLicencia.curso && alumnosPorCurso[nuevaLicencia.curso] ? alumnosPorCurso[nuevaLicencia.curso] : uniqueNombres).map(n => (
                              <option key={n} value={n}>{retiredStudentsMap.has(n) ? `${n}  (retirado)` : n}</option>
                            ))}
                            <option value="__OTRO__">+ Ingresar nuevo alumno...</option>
                          </select>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input 
                              required 
                              type="text" 
                              className="form-control"
                              value={nuevaLicencia.nombre} 
                              onChange={e => setNuevaLicencia({...nuevaLicencia, nombre: e.target.value.toUpperCase()})} 
                              placeholder="Escriba el nombre..." 
                              autoFocus
                            />
                            <button 
                              type="button" 
                              className="secondary" 
                              onClick={() => {
                                setInputManualLicencia(false);
                                setNuevaLicencia({...nuevaLicencia, nombre: ''});
                              }}
                              title="Volver a la lista"
                            >
                              Lista
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {duplicadas > 0 && (
                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.75rem 0.9rem', borderRadius: '12px', background: 'var(--accent-orange-light)', color: '#a8590a', fontSize: '0.85rem' }}>
                        <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>Este alumno ya tiene <strong>{duplicadas}</strong> registro(s) en este periodo. Verifica que no sea un duplicado.</span>
                      </div>
                    )}
                    {alumnoRetirado && (
                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.75rem 0.9rem', borderRadius: '12px', background: 'var(--accent-pink-light)', color: '#b02525', fontSize: '0.85rem' }}>
                        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>Este alumno figura como <strong>retirado</strong> en la nómina oficial.</span>
                      </div>
                    )}

                    <div className="grid-2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Tipo Certificado</label>
                        <select required value={nuevaLicencia.tipoCertificado} onChange={e => {
                          const tipo = e.target.value;
                          setNuevaLicencia({...nuevaLicencia, tipoCertificado: tipo, diasJustificados: ''});
                        }}>
                          <option value="licencia">Licencia Médica</option>
                          <option value="atencion">Certificado de Atención</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Días que acredita</label>
                        {nuevaLicencia.tipoCertificado === 'atencion' ? (
                          <select
                            required
                            value={nuevaLicencia.diasJustificados}
                            onChange={e => setNuevaLicencia({...nuevaLicencia, diasJustificados: e.target.value})}
                          >
                            <option value="">Seleccione...</option>
                            <option value="0">0 días (no acredita)</option>
                            <option value="1">1 día (acredita máximo)</option>
                          </select>
                        ) : (
                          <input required type="number" min="1" placeholder="Ej: 3" value={nuevaLicencia.diasJustificados} onChange={e => setNuevaLicencia({...nuevaLicencia, diasJustificados: e.target.value})} />
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                      <button type="button" className="secondary" style={{ flex: 1 }} onClick={cerrarModal}>Cancelar</button>
                      <button type="submit" className="primary" style={{ flex: 1 }}>{editandoLicenciaId ? 'Actualizar' : 'Guardar'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {lics.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', border: '2px dashed var(--border)', borderRadius: '16px', background: 'var(--bg-subtle)' }}>
                <div className="metric-icon" style={{ margin: '0 auto 1rem', background: 'var(--primary-ultra-light)', color: 'var(--primary)' }}>
                  <Stethoscope size={26} />
                </div>
                <h3 style={{ marginBottom: '0.4rem' }}>Aún no hay licencias este periodo</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Registra aquí cada licencia médica o certificado de atención que respalde una inasistencia.
                </p>
                <button className="primary" onClick={() => setShowLicenciaModal(true)}>
                  <Plus size={18} /> Agregar la primera licencia
                </button>
              </div>
            ) : filtradas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '2px dashed var(--border)', borderRadius: '16px', background: 'var(--bg-subtle)' }}>
                <div className="metric-icon" style={{ margin: '0 auto 1rem', background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                  <Search size={26} />
                </div>
                <h3 style={{ marginBottom: '0.4rem' }}>Sin resultados</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Ningún registro coincide con los filtros aplicados.
                </p>
                <button className="secondary" onClick={limpiarFiltros}>
                  <X size={16} /> Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Curso</th>
                      <th>Tipo</th>
                      <th style={{ textAlign: 'center' }}>Días</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map(l => {
                      const retirado = estaRetirado(l);
                      const atencion = esAtencion(l);
                      return (
                      <tr key={l.id} style={{ background: retirado ? 'var(--accent-pink-light)' : 'transparent' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: retirado ? 'var(--text-muted)' : 'var(--text-main)' }}>{l.nombre}</span>
                            {retirado && (
                              <span className="badge badge-red">
                                Retirado{retiredStudentsMap.get(l.nombre) ? ` · ${retiredStudentsMap.get(l.nombre)}` : (l.fechaRetiro ? ` · ${l.fechaRetiro}` : '')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {l.curso ? <span className="badge badge-blue">{l.curso}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td>
                          <span className={`badge ${atencion ? 'badge-orange' : 'badge-blue'}`}>
                            {atencion ? <ClipboardCheck size={13} /> : <Stethoscope size={13} />}
                            {atencion ? 'Cert. Atención' : 'Licencia Médica'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{Number(l.diasJustificados) || 0}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> día{(Number(l.diasJustificados) || 0) === 1 ? '' : 's'}</span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button 
                            className="secondary" 
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', marginRight: '0.5rem' }}
                            title="Editar licencia"
                            onClick={() => {
                              setNuevaLicencia({ nombre: l.nombre, curso: l.curso, tipoCertificado: l.tipoCertificado || 'licencia', diasJustificados: l.diasJustificados || '' });
                              setEditandoLicenciaId(l.id);
                              setInputManualLicencia(false);
                            }}
                          >
                            <Pencil size={14} /> Editar
                          </button>
                          <button 
                            className="danger" 
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                            title="Eliminar licencia"
                            onClick={() => setLicenciaAEliminar(l)}
                          >
                            <Trash2 size={14} /> Eliminar
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        );
      })()}

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
                <button className="secondary" onClick={() => { setShowImportModal(true); setImportStep('paste'); setImportText(''); setImportPreview(null); }}>
                  📅 Importar Asistencias
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

            {/* ===== MODAL IMPORTAR ASISTENCIAS ===== */}
            {showImportModal && (
              <div className="modal-overlay" style={{ zIndex: 1100 }}>
                <div className="modal-card animate-fade-in" style={{ maxWidth: '700px', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h3 style={{ marginBottom: '0.25rem' }}>📅 Importar Asistencias Masivas</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                        Paso {importStep === 'paste' ? '1 de 2: Pegar datos' : '2 de 2: Confirmar cambios'}
                      </p>
                    </div>
                    <button className="secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => { setShowImportModal(false); setImportText(''); setImportPreview(null); setImportStep('paste'); }}>
                      ✕ Cerrar
                    </button>
                  </div>

                  {importStep === 'paste' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ background: 'var(--primary-ultra-light)', border: '1px solid var(--border-card)', borderRadius: '12px', padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <strong style={{ color: 'var(--primary)' }}>💡 Formato aceptado (copiar desde Excel):</strong>
                        <br/>
                        Columnas en cualquier orden: <code style={{ background: '#e8edff', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>CURSO | NOMBRE | % ASISTENCIA</code>
                        <br/>
                        Separador: <strong>TAB</strong> (copiar directo de Excel) o <strong>punto y coma</strong> (CSV).
                        <br/>
                        El % puede incluir o no el símbolo <code style={{ background: '#e8edff', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>%</code>.
                        <br/><br/>
                        <strong>Ejemplo:</strong>
                        <pre style={{ margin: '0.5rem 0 0', background: 'white', padding: '0.5rem', borderRadius: '8px', fontSize: '0.8rem', overflowX: 'auto' }}>{`7Y8\tAGUERO AYALA FERNANDO\t75
7Y8\tCATRILEO CARO ALEJANDRA\t80
1Y2 HC\tFUENTES SALAS JUAN\t62`}</pre>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Pega aquí los datos del Excel:</label>
                        <textarea
                          value={importText}
                          onChange={e => setImportText(e.target.value)}
                          placeholder="Pega los datos copiados desde Excel..."
                          style={{ minHeight: '180px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                          autoFocus
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button className="secondary" onClick={() => { setShowImportModal(false); setImportText(''); }}>Cancelar</button>
                        <button
                          className="primary"
                          disabled={!importText.trim()}
                          onClick={handleParseImport}
                        >
                          Analizar Datos →
                        </button>
                      </div>
                    </div>
                  )}

                  {importStep === 'preview' && importPreview && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Summary chips */}
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ background: '#e6faf4', color: '#12b886', padding: '0.35rem 0.9rem', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem' }}>
                          ✅ {importPreview.matched.length} alumnos encontrados
                        </span>
                        {importPreview.unmatched.length > 0 && (
                          <span style={{ background: '#fff4e6', color: '#fd7e14', padding: '0.35rem 0.9rem', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem' }}>
                            ⚠️ {importPreview.unmatched.length} no encontrados
                          </span>
                        )}
                      </div>

                      {/* Matched preview table */}
                      {importPreview.matched.length > 0 && (
                        <div>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Se actualizarán estos registros:</p>
                          <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
                            <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: 'var(--bg-subtle)' }}>
                                  <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Alumno (Sistema)</th>
                                  <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Curso</th>
                                  <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>% Mes</th>
                                  <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>% Acum.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {importPreview.matched.map((r, i) => (
                                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.6rem 0.8rem' }}>{r.nombreExistente}</td>
                                    <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>{r.curso}</td>
                                    <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', fontWeight: 700, color: r.asistenciaMes < 50 ? 'var(--danger)' : r.asistenciaMes < 75 ? 'var(--warning)' : 'var(--success)' }}>
                                      {r.asistenciaMes}%
                                    </td>
                                    <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{r.asistenciaAcum}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Unmatched list */}
                      {importPreview.unmatched.length > 0 && (
                        <div>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fd7e14', marginBottom: '0.4rem' }}>⚠️ No se encontraron en el sistema (serán ignorados):</p>
                          <div style={{ background: '#fff9f0', border: '1px solid #ffd8a8', borderRadius: '10px', padding: '0.75rem', fontSize: '0.82rem', color: '#7d4100', maxHeight: '100px', overflowY: 'auto' }}>
                            {importPreview.unmatched.map((u, i) => (
                              <div key={i}>{u.nombre} {u.curso ? `(${u.curso})` : ''} — {u.pct}%</div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button className="secondary" onClick={() => setImportStep('paste')}>← Volver</button>
                        <button
                          className="primary"
                          disabled={importPreview.matched.length === 0}
                          onClick={handleConfirmImport}
                        >
                          ✅ Confirmar e Importar {importPreview.matched.length} registros
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                    <div className="grid-2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Curso</label>
                        <select required value={nuevaAlerta.curso} onChange={e => setNuevaAlerta({...nuevaAlerta, curso: e.target.value})}>
                          <option value="">Seleccione...</option>
                          {CURSOS_OFICIALES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Nombre Estudiante</label>
                        {!inputManualAlerta ? (
                          <select 
                            required 
                            className="form-control"
                            value={nuevaAlerta.nombre} 
                            onChange={e => {
                              if (e.target.value === '__OTRO__') {
                                setInputManualAlerta(true);
                                setNuevaAlerta({...nuevaAlerta, nombre: ''});
                              } else {
                                setNuevaAlerta({...nuevaAlerta, nombre: e.target.value});
                              }
                            }}
                            disabled={!nuevaAlerta.curso}
                          >
                            <option value="">{nuevaAlerta.curso ? "Seleccione alumno..." : "Primero seleccione curso"}</option>
                            {(nuevaAlerta.curso && alumnosPorCurso[nuevaAlerta.curso] ? alumnosPorCurso[nuevaAlerta.curso] : uniqueNombres).map(n => <option key={n} value={n}>{n}</option>)}
                            <option value="__OTRO__">+ Ingresar nuevo alumno...</option>
                          </select>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input 
                              required 
                              type="text" 
                              className="form-control"
                              value={nuevaAlerta.nombre} 
                              onChange={e => setNuevaAlerta({...nuevaAlerta, nombre: e.target.value.toUpperCase()})} 
                              placeholder="Escriba el nombre..." 
                              autoFocus
                            />
                            <button 
                              type="button" 
                              className="secondary" 
                              onClick={() => {
                                setInputManualAlerta(false);
                                setNuevaAlerta({...nuevaAlerta, nombre: ''});
                              }}
                              title="Volver a la lista"
                            >
                              Lista
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid-2">
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
                      <tr key={a.id} style={{ opacity: (a.retirado || retiredStudentsMap.has(a.nombre)) ? 0.5 : 1, background: (a.retirado || retiredStudentsMap.has(a.nombre)) ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                        <td>
                          {a.nombre}
                          {(a.retirado || retiredStudentsMap.has(a.nombre)) && (
                            <span style={{ marginLeft: '0.5rem', color: 'var(--red)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              (RETIRADO {retiredStudentsMap.get(a.nombre) || a.fechaRetiro ? `- ${retiredStudentsMap.get(a.nombre) || a.fechaRetiro}` : ''})
                            </span>
                          )}
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
      {subTab === 'config' && (
        <div className="animate-fade-in">
          <div className="card">
            <h2>Configuración del Sistema</h2>
            <div className="grid-2" style={{ marginTop: '1.5rem' }}>
              <div className="card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Estado de Conexión</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: offlineMode ? 'var(--red)' : 'var(--green)' }}></div>
                  <span>{offlineMode ? 'Modo Offline (Local)' : 'Conectado a Firebase (Nube)'}</span>
                </div>
                {offlineMode ? (
                  <button className="secondary" onClick={retryConnection}>
                    Intentar Reconectar
                  </button>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Los datos se están sincronizando automáticamente con el servidor en tiempo real.
                  </p>
                )}
              </div>

              <div className="card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Resumen de Registros</h3>
                <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Reportes Mensuales:</span>
                    <strong>{reportesList.length}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Mes Actual:</span>
                    <strong>{data.periodo || 'Sin asignar'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Estudiantes en Alerta (Mes):</span>
                    <strong>{data.alertas.length}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: '1.5rem', border: '1px solid var(--border-danger, rgba(239, 68, 68, 0.2))', background: 'rgba(239, 68, 68, 0.02)' }}>
              <h3 style={{ color: 'var(--red)', fontSize: '1rem' }}>Zona Crítica</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Acciones administrativas que afectan la base de datos local y remota.
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="secondary" onClick={() => {
                  if (window.confirm('¿Desea limpiar el cache local? Esto reiniciará la sesión.')) {
                    localStorage.removeItem('lastSelectedReportId');
                    window.location.reload();
                  }
                }}>
                  Limpiar Cache Local
                </button>
                <button className="danger" onClick={() => {
                   if (window.confirm('ATENCIÓN: ¿Está seguro de que desea eliminar TODO el historial de este mes? Esta acción no se puede deshacer.')) {
                     const resetData = { ...defaultData, periodo: data.periodo };
                     setData(resetData);
                     saveToFirebase(resetData, currentId);
                     alert('Datos del mes reseteados con éxito.');
                   }
                }}>
                  Resetear Datos del Mes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '1rem' }}>
             <button 
               className="secondary" 
               onClick={() => {
                 saveToFirebase(data, currentId);
                 setActiveTab('reporte');
               }}
             >
               <FileText size={18} /> Generar Reporte
             </button>
             <button 
               className="primary" 
               onClick={() => saveToFirebase(data, currentId)}
               disabled={saveStatus === 'saving'}
             >
               {saveStatus === 'saving' ? 'Guardando...' : 'Guardar Cambios'}
             </button>
          </div>
        </div>
      )}

      {activeTab === 'reporte' && (() => {
        const alertasFiltradasReporte = (data.alertas || []).filter(a => {
          const cumple50 = reportFilterUnder50 ? (Number(a.asistenciaAcum) < 50 || Number(a.asistenciaMes) < 50) : true;
          const cumpleDerivacion = reportFilterDerivacion ? (a.accion && a.accion.toLowerCase().includes('deriv')) : true;
          return cumple50 && cumpleDerivacion;
        });

        return (
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

            {/* Barra de Filtros (no-print) */}
            <div className="no-print card" style={{ 
              background: 'var(--bg-card)', 
              border: '1.5px solid var(--border)', 
              borderRadius: '16px', 
              padding: '1.25rem', 
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🔍 Opciones de Filtrado para Impresión
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Filtra la nómina de estudiantes en alerta antes de imprimir o guardar como PDF. Los filtros se aplicarán de forma instantánea.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <button 
                  className={`secondary ${reportFilterUnder50 ? 'active' : ''}`}
                  style={{ 
                    borderRadius: '20px', 
                    padding: '0.4rem 1rem', 
                    fontSize: '0.85rem',
                    borderColor: reportFilterUnder50 ? 'var(--primary)' : 'var(--border)',
                    background: reportFilterUnder50 ? 'var(--primary-glow)' : 'transparent',
                    color: reportFilterUnder50 ? '#fff' : 'var(--text-secondary)'
                  }}
                  onClick={() => setReportFilterUnder50(!reportFilterUnder50)}
                >
                  📉 Asistencia &lt; 50%
                </button>
                <button 
                  className={`secondary ${reportFilterDerivacion ? 'active' : ''}`}
                  style={{ 
                    borderRadius: '20px', 
                    padding: '0.4rem 1rem', 
                    fontSize: '0.85rem',
                    borderColor: reportFilterDerivacion ? 'var(--primary)' : 'var(--border)',
                    background: reportFilterDerivacion ? 'var(--primary-glow)' : 'transparent',
                    color: reportFilterDerivacion ? '#fff' : 'var(--text-secondary)'
                  }}
                  onClick={() => setReportFilterDerivacion(!reportFilterDerivacion)}
                >
                  📁 Sólo Derivaciones
                </button>
                {(reportFilterUnder50 || reportFilterDerivacion) && (
                  <button 
                    className="danger" 
                    style={{ 
                      borderRadius: '20px', 
                      padding: '0.4rem 1rem', 
                      fontSize: '0.85rem' 
                    }}
                    onClick={() => {
                      setReportFilterUnder50(false);
                      setReportFilterDerivacion(false);
                    }}
                  >
                    🔄 Limpiar Filtros
                  </button>
                )}
              </div>
            </div>

            <div className="card">
              <h2>1. Tablero de Control de Metas (Eficiencia Interna)</h2>
              <div className="grid-3" style={{ marginTop: '1.5rem' }}>
                
                {/* Matrícula */}
                <div className="metric-card">
                  <div className="metric-title">Matrícula Final (Mes)</div>
                  <div className={`metric-value ${matriculaFinal >= 136 ? 'status-green' : 'status-red'}`}>
                    {matriculaFinal}
                  </div>
                  <div className="metric-meta">
                    Meta ≥ 136 | 
                    {matriculaFinal >= 136 ? 
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
              
              {alertasFiltradasReporte.length > 0 ? (
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
                      {alertasFiltradasReporte.map(a => (
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
                  No se registraron estudiantes que cumplan con los criterios de filtrado seleccionados.
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
      );
    })()}

      {activeTab === 'expediente' && (() => {
        const periodosAgrupadosFiltrados = periodosAgrupados.map(p => {
          const alertasFiltradas = p.alertas.filter(a => {
            const cumple50 = expedienteFilterUnder50 ? (Number(a.asistenciaAcum) < 50 || Number(a.asistenciaMes) < 50) : true;
            const cumpleDerivacion = expedienteFilterDerivacion ? (a.accion && a.accion.toLowerCase().includes('deriv')) : true;
            return cumple50 && cumpleDerivacion;
          });
          return { ...p, alertas: alertasFiltradas };
        }).filter(p => p.alertas.length > 0 || p.licencias.length > 0);

        return (
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
                {selectedStudentForReport && periodosAgrupadosFiltrados.length > 0 && (
                  <button className="primary" onClick={printReport}>
                    <Printer size={18} /> Imprimir Expediente
                  </button>
                )}
              </div>
            </div>

            {selectedStudentForReport && (
              <>
                {/* Barra de Filtros (no-print) */}
                <div className="no-print card" style={{ 
                  background: 'var(--bg-card)', 
                  border: '1.5px solid var(--border)', 
                  borderRadius: '16px', 
                  padding: '1.25rem', 
                  marginBottom: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🔍 Opciones de Filtrado para Impresión
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Filtra el historial de alertas de este alumno antes de imprimir. Los filtros se aplicarán de forma instantánea.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    <button 
                      className={`secondary ${expedienteFilterUnder50 ? 'active' : ''}`}
                      style={{ 
                        borderRadius: '20px', 
                        padding: '0.4rem 1rem', 
                        fontSize: '0.85rem',
                        borderColor: expedienteFilterUnder50 ? 'var(--primary)' : 'var(--border)',
                        background: expedienteFilterUnder50 ? 'var(--primary-glow)' : 'transparent',
                        color: expedienteFilterUnder50 ? '#fff' : 'var(--text-secondary)'
                      }}
                      onClick={() => setExpedienteFilterUnder50(!expedienteFilterUnder50)}
                    >
                      📉 Asistencia &lt; 50%
                    </button>
                    <button 
                      className={`secondary ${expedienteFilterDerivacion ? 'active' : ''}`}
                      style={{ 
                        borderRadius: '20px', 
                        padding: '0.4rem 1rem', 
                        fontSize: '0.85rem',
                        borderColor: expedienteFilterDerivacion ? 'var(--primary)' : 'var(--border)',
                        background: expedienteFilterDerivacion ? 'var(--primary-glow)' : 'transparent',
                        color: expedienteFilterDerivacion ? '#fff' : 'var(--text-secondary)'
                      }}
                      onClick={() => setExpedienteFilterDerivacion(!expedienteFilterDerivacion)}
                    >
                      📁 Sólo Derivaciones
                    </button>
                    {(expedienteFilterUnder50 || expedienteFilterDerivacion) && (
                      <button 
                        className="danger" 
                        style={{ 
                          borderRadius: '20px', 
                          padding: '0.4rem 1rem', 
                          fontSize: '0.85rem' 
                        }}
                        onClick={() => {
                          setExpedienteFilterUnder50(false);
                          setExpedienteFilterDerivacion(false);
                        }}
                      >
                        🔄 Limpiar Filtros
                      </button>
                    )}
                  </div>
                </div>

                {periodosAgrupadosFiltrados.length > 0 ? (
                  <div className="card" style={{ background: '#fff', color: '#000' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #eee', paddingBottom: '1.5rem' }}>
                      <h1 style={{ color: '#000', marginBottom: '0.5rem', fontSize: '2rem' }}>EXPEDIENTE DE ACTUACIONES</h1>
                      <h2 style={{ color: '#1e293b', fontSize: '1.5rem', fontWeight: 600 }}>ALUMNO(A): {selectedStudentForReport.toUpperCase()}</h2>
                      <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Inspectoría General - CEIA Juanita Zúñiga Fuentes</p>
                    </div>

                    {/* DASHBOARD VISUAL DE TENDENCIAS */}
                    <div className="no-print" style={{ marginBottom: '3rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <h3 style={{ color: '#0f172a', fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TrendingUp size={20} className="status-green" /> Análisis de Evolución Mensual
                      </h3>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ padding: '1rem', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>Asistencia Promedio</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>
                            {periodosAgrupadosFiltrados.length > 0 
                              ? Math.round(periodosAgrupadosFiltrados.reduce((acc, p) => acc + (p.alertas[0]?.asistenciaAcum || 0), 0) / periodosAgrupadosFiltrados.length)
                              : 0}%
                          </div>
                        </div>
                        <div style={{ padding: '1rem', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>Alertas Registradas</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>
                            {periodosAgrupadosFiltrados.reduce((acc, p) => acc + p.alertas.length, 0)}
                          </div>
                        </div>
                        <div style={{ padding: '1rem', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>Licencias/Justificativos</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>
                            {periodosAgrupadosFiltrados.reduce((acc, p) => acc + p.licencias.length, 0)}
                          </div>
                        </div>
                      </div>

                      <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '1rem', padding: '1rem 0', borderBottom: '2px solid #e2e8f0' }}>
                        {periodosAgrupadosFiltrados.map((p, i) => {
                          const asist = p.alertas[0]?.asistenciaAcum || 0;
                          return (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: '60px' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: asist < 60 ? '#ef4444' : '#10b981' }}>{asist}%</div>
                              <div style={{ 
                                width: '100%', 
                                height: `${asist}%`, 
                                background: asist < 60 ? 'linear-gradient(to top, #fee2e2, #ef4444)' : 'linear-gradient(to top, #d1fae5, #10b981)',
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.5s ease'
                              }}></div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>
                                {p.periodo.split(' ')[0]}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {periodosAgrupadosFiltrados.map((p, index) => (
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
                ) : (
                  <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <AlertTriangle size={48} style={{ color: 'var(--warning)', marginBottom: '1rem' }} />
                    <h3>Sin registros coincidentes</h3>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0.5rem auto 0 auto' }}>
                      No se encontraron registros de alertas o justificaciones para este estudiante que coincidan con los filtros de búsqueda y asistencia seleccionados.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
