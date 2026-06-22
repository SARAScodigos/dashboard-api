"use strict";

/**
 * Generador local de dashboards contables.
 *
 * Nota de seguridad: el código producido por un modelo no debe ejecutarse en el
 * documento principal. Aquí se monta en un iframe sin `allow-same-origin` y con
 * una política CSP restrictiva. Así no puede leer la API key ni el localStorage.
 */

const STORAGE_KEYS = {
  provider: "accountingDashboard.aiProvider",
  apiKey: "accountingDashboard.geminiApiKey",
  claudeApiKey: "accountingDashboard.claudeApiKey",
  openaiApiKey: "accountingDashboard.openaiApiKey",
  company: "accountingDashboard.companyName",
  model: "accountingDashboard.geminiModel",
  providerModels: "accountingDashboard.providerModels",
  systemPrompt: "accountingDashboard.systemPrompt",
  dataPrompt: "accountingDashboard.dataPrompt",
};

const DASHBOARD_DB = {
  name: "accountingDashboardStorage",
  version: 1,
  store: "dashboards",
  lastKey: "last-generated-dashboard",
};

const DEFAULT_PROVIDER = "gemini";
const PROVIDERS = {
  gemini: {
    name: "Google Gemini",
    keyLabel: "API Key de Google Gemini",
    keyPlaceholder: "AIza...",
    keyStorage: STORAGE_KEYS.apiKey,
    defaultModel: "gemini-3.5-flash",
    models: [
      ["gemini-3.5-flash", "Gemini 3.5 Flash (recomendado)"],
      ["gemini-3.1-pro-preview", "Gemini 3.1 Pro Preview"],
      ["gemini-3-flash-preview", "Gemini 3 Flash Preview"],
    ],
  },
  claude: {
    name: "Anthropic Claude",
    keyLabel: "API Key de Anthropic Claude",
    keyPlaceholder: "sk-ant-...",
    keyStorage: STORAGE_KEYS.claudeApiKey,
    defaultModel: "claude-sonnet-4-6",
    models: [
      ["claude-sonnet-4-6", "Claude Sonnet 4.6 (recomendado)"],
      ["claude-opus-4-8", "Claude Opus 4.8"],
      ["claude-haiku-4-5", "Claude Haiku 4.5"],
    ],
  },
  openai: {
    name: "OpenAI",
    keyLabel: "API Key de OpenAI",
    keyPlaceholder: "sk-...",
    keyStorage: STORAGE_KEYS.openaiApiKey,
    defaultModel: "gpt-5.5",
    models: [
      ["gpt-5.5", "GPT-5.5"],
      ["gpt-4.1-mini", "GPT-4.1 mini"],
      ["gpt-4.1", "GPT-4.1 (serie 4 recomendada)"],
    ],
  },
};
const MAX_RECORDS = 10;
const DEFAULT_SYSTEM_PROMPT = `Eres un 'Generador de Dashboards Financieros Automatizado'. Tu único propósito es recibir una muestra de datos en formato JSON (provenientes de un CSV) para comprender su estructura y nombres de columnas, y devolver CÓDIGO HTML Y JAVASCRIPT funcional, dinámico y algorítmico para visualizar la totalidad de los datos.

TUS REGLAS ESTRICTAS E INQUEBRANTABLES:

Cero charla: NO saludes, NO des explicaciones, NO uses formato markdown (html). Devuelve ÚNICAMENTE código puro que empiece con <div> y termine con </div> o <script>.

Contenedor: Tu código será inyectado dentro de un elemento existente. NO generes etiquetas <html>, <head> o <body>.

Librerías disponibles: Plotly.js y Tailwind CSS están cargados dentro del entorno de ejecución. Usa Plotly para graficar y Tailwind para el diseño visual.

Análisis Estructural (Data Profiling): Analiza las llaves (columnas) del JSON de muestra que recibes. Identifica qué columnas representan categorías (texto), cuáles fechas o años, y cuáles variables cuantitativas (montos, costos, cantidades).

Código 100% Dinámico (Prohibido Hardcodear): El código JavaScript que generes NO debe contener datos fijos ni arreglos estáticos extraídos de la muestra. Debes programar funciones algorítmicas en JavaScript puro que recorran el arreglo global window.uploadedData.

Ejemplo: Si identificas una columna de 'Productos', utiliza [...new Set(window.uploadedData.map(item => item.Productos))] para extraer dinámicamente los elementos únicos en tiempo de ejecución, calcular sus frecuencias o sumar sus montos con .reduce().

Diseño del Entorno: Diseña con Tailwind CSS una cuadrícula responsiva que contenga:

Al menos 4 tarjetas de KPIs cuyos valores se calculen dinámicamente operando sobre la totalidad de los registros de window.uploadedData (ej. sumas totales, promedios, conteos únicos).

Al menos 3 gráficos de Plotly.js que se alimenten de las variables procesadas dinámicamente por tus algoritmos.

Robustez: Si faltan datos en alguna fila o una conversión numérica falla en tiempo de ejecución, el JavaScript generado debe gestionarlo de forma segura (ej. usando parseFloat(x) || 0) para evitar que el dashboard deje de renderizarse en pantalla.

Tecnologías permitidas: usa exclusivamente Plotly.js para gráficos y Tailwind CSS para estilos.\n
Tecnologías prohibidas: NO uses WebGL directo, D3.js, Three.js, WebWorkers, ni otras librerías que no estén listadas como disponibles. No cargues scripts desde CDNs distintos a los ya permitidos en el entorno y no realices peticiones de red desde el código generado. Si el modelo propone una técnica no permitida, reescribe la solución usando sólo Plotly y Tailwind.
agrega tono blur y con filtro de dia y de noche
`;

// Estas reglas se adjuntan siempre, incluso si el usuario personaliza su System Prompt.
// Describen el contrato real entre Gemini y el entorno local de ejecución.
const RUNTIME_DATA_INSTRUCTIONS = `
CONTRATO DE DATOS Y ANÁLISIS DINÁMICO:
- El JSON recibido es solo una muestra de 10 filas para inferir la forma de los datos. No representa todas las categorías ni todos los valores existentes.
- Cuando el código se ejecute, window.uploadedData contendrá TODAS las filas del CSV original. Nunca copies al código arreglos de valores, categorías o cifras observadas en la muestra.
- Inspecciona las columnas y sus valores en tiempo de ejecución. No dependas de una estructura rígida ni de nombres de columnas predeterminados.
- Distingue dinámicamente entre: medidas numéricas, fechas, categorías útiles, identificadores y texto libre.
- Omite texto libre, descripciones extensas e identificadores de alta cardinalidad como dimensiones de gráficos.
- Para una categoría útil, obtén sus valores únicos desde window.uploadedData y calcula conteos, sumas o promedios por categoría con map, filter y reduce. No construyas una simple lista si existe una comparación contable más informativa.
- Convierte y valida números antes de agregarlos; excluye valores vacíos o inválidos sin detener el dashboard.
- Si una columna no resulta útil para KPIs, agrupaciones o tendencias, ignórala.
- Plotly.js y Tailwind CSS están disponibles dentro del entorno de ejecución.
- Puedes usar clases utilitarias de Tailwind y complementar el diseño con una etiqueta <style> cuando sea necesario.`;
// Refuerzo explícito de tecnologías permitidas en tiempo de ejecución
// (ayuda a los modelos y a revisores humanos a entender limitaciones).
const RUNTIME_TECH_CONSTRAINTS = `
Tecnologías permitidas en tiempo de ejecución: Plotly.js y Tailwind CSS (ya cargadas).\n
Tecnologías prohibidas: NO uses WebGL directo, D3.js, Three.js, WebWorkers, ni cargues scripts externos desde el código generado.\n
El código generado no debe realizar conexiones de red ni ejecutar operaciones fuera del iframe sandbox.`;

// Adjuntamos estas restricciones al contrato de datos para que siempre estén disponibles.
// (Se combinan en el mensaje enviado al modelo más tarde en runtime cuando sea necesario.)

const elements = {
  companyTitle: document.querySelector("#company-title"),
  welcomePanel: document.querySelector("#welcome-panel"),
  renderZone: document.querySelector("#dashboard-render-zone"),
  csvInput: document.querySelector("#csv-input"),
  uploadButton: document.querySelector("#upload-button"),
  fileName: document.querySelector("#file-name"),
  fileDetails: document.querySelector("#file-details"),
  generateButton: document.querySelector("#generate-button"),
  readyPanel: document.querySelector("#dashboard-ready-panel"),
  readyDetails: document.querySelector("#dashboard-ready-details"),
  viewDashboardButton: document.querySelector("#view-dashboard-button"),
  regenerateButton: document.querySelector("#regenerate-button"),
  status: document.querySelector("#status-message"),
  dialog: document.querySelector("#settings-dialog"),
  settingsForm: document.querySelector("#settings-form"),
  openSettings: document.querySelector("#open-settings-button"),
  closeSettings: document.querySelector("#close-settings-button"),
  clearSettings: document.querySelector("#clear-settings-button"),
  toggleKey: document.querySelector("#toggle-key-button"),
  providerInput: document.querySelector("#provider-input"),
  apiKeyLabel: document.querySelector("#api-key-label"),
  apiKeyHelp: document.querySelector("#api-key-help"),
  apiKeyInput: document.querySelector("#api-key-input"),
  companyInput: document.querySelector("#company-name-input"),
  modelInput: document.querySelector("#model-input"),
  systemPromptInput: document.querySelector("#system-prompt-input"),
  dataPromptInput: document.querySelector("#data-prompt-input"),
  advancedPrompt: document.querySelector(".advanced-prompt"),
};

let parsedRows = [];
let isGenerating = false;
let currentFileName = "CSV restaurado";
let lastDashboard = null;
let activeProvider = DEFAULT_PROVIDER;
let providerDrafts = {};

initialize();

async function initialize() {
  loadSettings();
  bindEvents();
  await restoreLastDashboard();
}

function bindEvents() {
  window.addEventListener("message", handleDashboardMessage);
  window.addEventListener("beforeunload", warnBeforeLeaving);
  window.addEventListener("keydown", handleGlobalKeydown);
  elements.openSettings.addEventListener("click", openSettingsDialog);
  elements.closeSettings.addEventListener("click", () => elements.dialog.close());
  elements.settingsForm.addEventListener("submit", saveSettings);
  elements.clearSettings.addEventListener("click", clearSettings);
  elements.toggleKey.addEventListener("click", toggleApiKeyVisibility);
  elements.providerInput.addEventListener("change", handleProviderChange);

  elements.uploadButton.addEventListener("click", () => elements.csvInput.click());
  elements.csvInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) parseFile(file);
  });

  // Permite soltar un CSV sobre la zona de carga.
  ["dragenter", "dragover"].forEach((eventName) => {
    elements.uploadButton.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.uploadButton.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    elements.uploadButton.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.uploadButton.classList.remove("is-dragging");
    });
  });

    elements.uploadButton.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files;
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      setStatus("Selecciona un archivo con extensión .csv o .xlsx.", "error");
      return;
    }
    parseFile(file);
  });

  elements.generateButton.addEventListener("click", generateDashboard);
  elements.viewDashboardButton.addEventListener("click", openDashboardView);
  elements.regenerateButton.addEventListener("click", generateDashboard);
}

function warnBeforeLeaving(event) {
  if (!isGenerating) return;
  event.preventDefault();
  event.returnValue = "";
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && elements.renderZone.classList.contains("is-visible")) {
    closeDashboardView();
  }
}

function loadSettings() {
  const company = localStorage.getItem(STORAGE_KEYS.company) || "Mi Empresa";
  const prompt = localStorage.getItem(STORAGE_KEYS.systemPrompt) || DEFAULT_SYSTEM_PROMPT;
  const storedProvider = localStorage.getItem(STORAGE_KEYS.provider);
  activeProvider = PROVIDERS[storedProvider] ? storedProvider : DEFAULT_PROVIDER;

  let storedModels = {};
  try {
    storedModels = JSON.parse(localStorage.getItem(STORAGE_KEYS.providerModels) || "{}");
  } catch {
    storedModels = {};
  }

  providerDrafts = Object.fromEntries(
    Object.entries(PROVIDERS).map(([provider, config]) => [
      provider,
      {
        apiKey: localStorage.getItem(config.keyStorage) || "",
        model:
          storedModels[provider] ||
          (provider === "gemini" ? localStorage.getItem(STORAGE_KEYS.model) : "") ||
          config.defaultModel,
      },
    ]),
  );

  elements.companyTitle.textContent = company;
  elements.companyInput.value = company;
  elements.systemPromptInput.value = prompt;
  elements.dataPromptInput.value = localStorage.getItem(STORAGE_KEYS.dataPrompt) || "";
  elements.providerInput.value = activeProvider;
  populateProviderFields(activeProvider);
}

function captureCurrentProviderDraft() {
  if (!PROVIDERS[activeProvider]) return;
  providerDrafts[activeProvider] = {
    apiKey: elements.apiKeyInput.value.trim(),
    model: elements.modelInput.value,
  };
}

function handleProviderChange() {
  captureCurrentProviderDraft();
  activeProvider = elements.providerInput.value;
  populateProviderFields(activeProvider);
}

function populateProviderFields(provider) {
  const config = PROVIDERS[provider];
  const draft = providerDrafts[provider] || {
    apiKey: "",
    model: config.defaultModel,
  };

  elements.apiKeyLabel.textContent = config.keyLabel;
  elements.apiKeyInput.placeholder = config.keyPlaceholder;
  elements.apiKeyInput.value = draft.apiKey;
  elements.apiKeyHelp.textContent = `Esta clave de ${config.name} se guarda únicamente en el localStorage de este navegador.`;

  elements.modelInput.replaceChildren(
    ...config.models.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );

  const modelExists = config.models.some(([value]) => value === draft.model);
  elements.modelInput.value = modelExists ? draft.model : config.defaultModel;
}

function openSettingsDialog() {
  loadSettings();
  elements.advancedPrompt.open = false;
  elements.dialog.showModal();
  window.setTimeout(() => elements.companyInput.focus(), 50);
}

function saveSettings(event) {
  event.preventDefault();

  captureCurrentProviderDraft();
  const company = elements.companyInput.value.trim() || "Mi Empresa";
  const provider = elements.providerInput.value;
  const apiKey = providerDrafts[provider]?.apiKey || "";
  const model = providerDrafts[provider]?.model || "";
  const prompt = elements.systemPromptInput.value.trim();
  const dataPrompt = elements.dataPromptInput.value.trim();

  if (!apiKey || !model || !prompt) {
    elements.settingsForm.reportValidity();
    return;
  }

  localStorage.setItem(STORAGE_KEYS.company, company);
  localStorage.setItem(STORAGE_KEYS.provider, provider);
  Object.entries(PROVIDERS).forEach(([providerId, config]) => {
    localStorage.setItem(config.keyStorage, providerDrafts[providerId]?.apiKey || "");
  });
  localStorage.setItem(
    STORAGE_KEYS.providerModels,
    JSON.stringify(
      Object.fromEntries(
        Object.entries(PROVIDERS).map(([providerId, config]) => [
          providerId,
          providerDrafts[providerId]?.model || config.defaultModel,
        ]),
      ),
    ),
  );
  // Mantiene compatibilidad con configuraciones antiguas de Gemini.
  localStorage.setItem(STORAGE_KEYS.model, providerDrafts.gemini.model);
  localStorage.setItem(STORAGE_KEYS.systemPrompt, prompt);
  localStorage.setItem(STORAGE_KEYS.dataPrompt, dataPrompt);

  elements.companyTitle.textContent = company;
  elements.dialog.close();
  setStatus(`${PROVIDERS[provider].name} y el modelo ${model} quedaron seleccionados.`);
}

async function clearSettings() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  await deleteDashboardSnapshot().catch((error) => console.warn("No se pudo borrar el dashboard guardado:", error));
  parsedRows = [];
  lastDashboard = null;
  currentFileName = "CSV restaurado";
  elements.readyPanel.hidden = true;
  elements.generateButton.disabled = true;
  elements.uploadButton.classList.remove("has-file");
  elements.fileName.textContent = "Selecciona tu archivo CSV";
  elements.fileDetails.textContent = "Solo 10 filas se envían al proveedor; el CSV completo se procesa localmente";
  closeDashboardView();
  loadSettings();
  setStatus("Configuración, datos y dashboard guardado eliminados.");
}

function toggleApiKeyVisibility() {
  const isPassword = elements.apiKeyInput.type === "password";
  elements.apiKeyInput.type = isPassword ? "text" : "password";
  elements.toggleKey.textContent = isPassword ? "Ocultar" : "Ver";
  elements.toggleKey.setAttribute("aria-label", isPassword ? "Ocultar API Key" : "Mostrar API Key");
}

function parseCsv(file) {
  if (typeof Papa === "undefined") {
    setStatus("No se pudo cargar PapaParse. Revisa tu conexión a Internet.", "error");
    return;
  }

  setStatus("Leyendo y validando el archivo…", "loading");

  Papa.parse(file, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: true,
    transformHeader: (header) => header.trim(),
    complete(results) {
      const validRows = results.data.filter((row) =>
        Object.values(row).some((value) => value !== null && value !== "" && value !== undefined),
      );

      if (!validRows.length || !results.meta.fields?.length) {
        parsedRows = [];
        elements.generateButton.disabled = true;
        setStatus("El CSV no contiene registros o encabezados válidos.", "error");
        return;
      }

      parsedRows = validRows;
      currentFileName = file.name;
      lastDashboard = null;
      elements.readyPanel.hidden = true;
      deleteDashboardSnapshot().catch((error) => console.warn("No se pudo limpiar el dashboard anterior:", error));
      elements.fileName.textContent = file.name;
      elements.fileDetails.textContent = `${formatNumber(validRows.length)} registros · ${results.meta.fields.length} columnas`;
      elements.uploadButton.classList.add("has-file");
      elements.generateButton.disabled = false;

      const warning = results.errors.length ? ` Se detectaron ${results.errors.length} advertencias de lectura.` : "";
      setStatus(`CSV listo. Se enviarán ${Math.min(validRows.length, MAX_RECORDS)} registros.${warning}`);
    },
    error(error) {
      parsedRows = [];
      elements.generateButton.disabled = true;
      setStatus(`No fue posible leer el CSV: ${error.message}`, "error");
    },
  });
}
// Carga un script dinámicamente (por ejemplo SheetJS) y devuelve una promesa.
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar " + src));
    document.head.appendChild(s);
  });
}

// Reemplaza a `parseCsv` y soporta CSV y XLSX.
async function parseFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    // Mantener compatibilidad con PapaParse para CSV.
    return parseCsv(file);
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    if (typeof XLSX === "undefined") {
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js");
      } catch (err) {
        setStatus("No se pudo cargar la biblioteca para XLSX. Revisa tu conexión a Internet.", "error");
        return;
      }
    }

    setStatus("Leyendo y validando el archivo XLSX…", "loading");

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = reader.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: null });

        const validRows = json.filter((row) =>
          Object.values(row).some((value) => value !== null && value !== "" && value !== undefined),
        );

        if (!validRows.length || !Object.keys(json[0] || {}).length) {
          parsedRows = [];
          elements.generateButton.disabled = true;
          setStatus("El XLSX no contiene registros o encabezados válidos.", "error");
          return;
        }

        parsedRows = validRows;
        currentFileName = file.name;
        lastDashboard = null;
        elements.readyPanel.hidden = true;
        deleteDashboardSnapshot().catch((error) => console.warn("No se pudo limpiar el dashboard anterior:", error));
        elements.fileName.textContent = file.name;
        elements.fileDetails.textContent = `${formatNumber(validRows.length)} registros · ${Object.keys(json[0]).length} columnas`;
        elements.uploadButton.classList.add("has-file");
        elements.generateButton.disabled = false;

        setStatus(`XLSX listo. Se enviarán ${Math.min(validRows.length, MAX_RECORDS)} registros.`);
      } catch (error) {
        parsedRows = [];
        elements.generateButton.disabled = true;
        setStatus(`No fue posible leer el XLSX: ${error.message}`, "error");
      }
    };

    reader.onerror = () => {
      setStatus("No fue posible leer el archivo XLSX.", "error");
    };

    reader.readAsArrayBuffer(file);
    return;
  }

  setStatus("Formato de archivo no soportado.", "error");
}

async function generateDashboard() {
  if (isGenerating || !parsedRows.length) return;

  const storedProvider = localStorage.getItem(STORAGE_KEYS.provider);
  const provider = PROVIDERS[storedProvider] ? storedProvider : DEFAULT_PROVIDER;
  const providerConfig = PROVIDERS[provider];
  const apiKey = localStorage.getItem(providerConfig.keyStorage) || "";
  let storedModels = {};
  try {
    storedModels = JSON.parse(localStorage.getItem(STORAGE_KEYS.providerModels) || "{}");
  } catch {
    storedModels = {};
  }
  const model = normalizeModelName(storedModels[provider] || providerConfig.defaultModel);
  const systemPrompt = localStorage.getItem(STORAGE_KEYS.systemPrompt) || DEFAULT_SYSTEM_PROMPT;
  const dataPrompt = localStorage.getItem(STORAGE_KEYS.dataPrompt) || "";

  if (!apiKey) {
    setStatus(`Guarda primero tu API Key de ${providerConfig.name} en Configuración.`, "error");
    openSettingsDialog();
    return;
  }

  setGenerating(true);
  setStatus(`${providerConfig.name} está analizando la muestra y diseñando el dashboard…`, "loading");

  try {
    const sample = parsedRows.slice(0, MAX_RECORDS);
    const completeSystemPrompt = `${systemPrompt}\n\n${RUNTIME_DATA_INSTRUCTIONS}`;
    const userMessage = `Empresa: ${elements.companyTitle.textContent}\nRegistros totales disponibles localmente: ${parsedRows.length}\nInstrucciones específicas del usuario para este análisis: ${dataPrompt || "Sin instrucciones adicionales; elige el análisis más útil según los datos."}\nLa API recibe únicamente esta muestra de ${sample.length} filas. El código final encontrará el conjunto completo en window.uploadedData:\n${JSON.stringify(sample)}`;
    const request = createProviderRequest({
      provider,
      apiKey,
      model,
      systemPrompt: completeSystemPrompt,
      userMessage,
    });
    const response = await fetch(request.endpoint, request.options);

    const payload = await response.json().catch(() => ({}));

    console.groupCollapsed(`${providerConfig.name} API · respuesta HTTP ${response.status}`);
    console.log("Respuesta JSON completa:", payload);
    console.groupEnd();

    if (!response.ok) {
      throw new Error(payload.error?.message || `La API respondió con estado ${response.status}.`);
    }

    const generatedCode = extractResponseText(provider, payload);
    console.groupCollapsed(`${providerConfig.name} API · código devuelto`);
    console.log(generatedCode || "(respuesta sin texto)");
    console.groupEnd();

    if (!generatedCode) {
      const reason = getEmptyResponseReason(provider, payload);
      throw new Error(
        reason
          ? `${providerConfig.name} no devolvió contenido (${reason}).`
          : `${providerConfig.name} devolvió una respuesta vacía.`,
      );
    }

    const cleanedCode = cleanGeneratedCode(generatedCode);
    console.groupCollapsed("Dashboard · código limpio que será ejecutado");
    console.log(cleanedCode);
    console.groupEnd();

    const snapshot = {
      code: cleanedCode,
      data: parsedRows,
      fileName: currentFileName,
      rowCount: parsedRows.length,
      provider,
      model,
      createdAt: Date.now(),
    };

    lastDashboard = snapshot;
    let persisted = true;
    try {
      await saveDashboardSnapshot(snapshot);
    } catch (storageError) {
      persisted = false;
      console.warn("El dashboard funciona en memoria, pero no pudo guardarse:", storageError);
    }

    showDashboardReady(snapshot, persisted);
    setStatus(
      persisted
        ? `Dashboard generado y guardado con ${providerConfig.name} (${model}). La IA analizó ${sample.length} filas; los cálculos usarán ${formatNumber(parsedRows.length)} filas localmente.`
        : "Dashboard generado, pero el navegador no permitió guardarlo. Puedes verlo mientras esta página permanezca abierta.",
      persisted ? "info" : "error",
    );
  } catch (error) {
    console.error("Error al generar el dashboard:", error);
    setStatus(humanizeApiError(error), "error");
  } finally {
    setGenerating(false);
  }
}

function createProviderRequest({ provider, apiKey, model, systemPrompt, userMessage }) {
  if (provider === "claude") {
    return {
      endpoint: "https://api.anthropic.com/v1/messages",
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: 32768,
          temperature: 0.2,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      },
    };
  }

  if (provider === "openai") {
    return {
      endpoint: "https://api.openai.com/v1/responses",
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          instructions: systemPrompt,
          input: userMessage,
          max_output_tokens: 32768,
        }),
      },
    };
  }

  return {
    endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    options: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 32768,
        },
      }),
    },
  };
}

function extractResponseText(provider, payload) {
  if (provider === "claude") {
    return (payload.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join("\n")
      .trim();
  }

  if (provider === "openai") {
    if (typeof payload.output_text === "string") return payload.output_text.trim();
    return (payload.output || [])
      .flatMap((item) => item.content || [])
      .filter((content) => content.type === "output_text")
      .map((content) => content.text || "")
      .join("\n")
      .trim();
  }

  return (payload.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();
}

function getEmptyResponseReason(provider, payload) {
  if (provider === "claude") return payload.stop_reason;
  if (provider === "openai") return payload.status || payload.incomplete_details?.reason;
  return payload.promptFeedback?.blockReason || payload.candidates?.[0]?.finishReason;
}

function cleanGeneratedCode(rawCode) {
  let code = rawCode.trim();
  code = code.replace(/^```(?:html|javascript|js)?\s*/i, "");
  code = code.replace(/\s*```\s*$/i, "");

  // Elimina elementos que no aportan al dashboard y amplían la superficie de ataque.
  code = code.replace(/<base\b[^>]*>/gi, "");
  code = code.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, "");
  code = code.replace(/<iframe\b[\s\S]*?<\/iframe\s*>/gi, "");
  code = code.replace(/<object\b[\s\S]*?<\/object\s*>/gi, "");
  code = code.replace(/<embed\b[^>]*>/gi, "");

  if (!code) throw new Error("La respuesta no contiene HTML utilizable.");
  return code;
}

function renderInSandbox(generatedHtml, uploadedData) {
  const frame = document.createElement("iframe");
  frame.className = "dashboard-frame";
  frame.title = "Dashboard contable generado";
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.addEventListener("load", () => {
    console.info("Dashboard · iframe cargado; esperando la ejecución del código generado.");
  });
  frame.srcdoc = buildSandboxDocument(generatedHtml, uploadedData);

  const shell = document.createElement("section");
  shell.className = "dashboard-shell";

  const toolbar = document.createElement("header");
  toolbar.className = "dashboard-toolbar";
  toolbar.innerHTML = `
    <div class="dashboard-toolbar-copy">
      <strong>Dashboard generado</strong>
      <small></small>
    </div>
    <div class="dashboard-toolbar-actions">
      <button class="button button-secondary" data-action="regenerate" type="button">Generar nuevamente</button>
      <button class="button button-primary" data-action="close" type="button">Volver</button>
    </div>`;
  const providerName = PROVIDERS[lastDashboard?.provider]?.name || "IA";
  const modelName = lastDashboard?.model ? ` · ${lastDashboard.model}` : "";
  toolbar.querySelector("small").textContent = `${currentFileName} · ${formatNumber(uploadedData.length)} registros · ${providerName}${modelName}`;
  toolbar.querySelector('[data-action="regenerate"]').addEventListener("click", () => {
    closeDashboardView();
    generateDashboard();
  });
  toolbar.querySelector('[data-action="close"]').addEventListener("click", closeDashboardView);

  shell.append(toolbar, frame);
  elements.renderZone.replaceChildren(shell);
  elements.renderZone.classList.add("is-visible");
  elements.renderZone.setAttribute("role", "dialog");
  elements.renderZone.setAttribute("aria-modal", "true");
  elements.renderZone.setAttribute("aria-label", "Dashboard generado en pantalla completa");
  document.body.classList.add("dashboard-open");
}

function openDashboardView() {
  if (!lastDashboard?.code || !Array.isArray(lastDashboard.data)) {
    setStatus("No hay un dashboard guardado para mostrar.", "error");
    return;
  }

  currentFileName = lastDashboard.fileName || currentFileName;
  renderInSandbox(lastDashboard.code, lastDashboard.data);
}

function closeDashboardView() {
  elements.renderZone.classList.remove("is-visible");
  document.body.classList.remove("dashboard-open");
}

function showDashboardReady(snapshot, persisted = true) {
  const date = new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(snapshot.createdAt));

  const providerName = PROVIDERS[snapshot.provider]?.name || "IA";
  const modelName = snapshot.model ? ` · ${snapshot.model}` : "";
  elements.readyDetails.textContent = `${formatNumber(snapshot.rowCount)} registros · ${providerName}${modelName} · ${date}${persisted ? " · guardado localmente" : ""}`;
  elements.readyPanel.hidden = false;
}

function buildSandboxDocument(generatedHtml, uploadedData) {
  const csp = [
    "default-src 'none'",
    "script-src 'unsafe-inline' https://cdn.plot.ly https://cdn.jsdelivr.net",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src 'none'",
    "connect-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");

  const sandboxHead = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <script>
      (() => {
        const report = (type, details = {}) => parent.postMessage({
          channel: "accounting-dashboard-runtime",
          type,
          ...details
        }, "*");

        window.addEventListener("error", (event) => report("error", {
          message: event.message || "Error desconocido dentro del dashboard",
          filename: event.filename,
          line: event.lineno,
          column: event.colno
        }));

        window.addEventListener("unhandledrejection", (event) => report("error", {
          message: event.reason?.message || String(event.reason || "Promesa rechazada")
        }));

        window.addEventListener("DOMContentLoaded", () => report("ready", {
          rows: Array.isArray(window.uploadedData) ? window.uploadedData.length : 0
        }));

        window.addEventListener("load", () => setTimeout(() => {
          const visibleElements = [...document.body.querySelectorAll("*")].filter((element) => {
            if (["SCRIPT", "STYLE", "LINK", "META"].includes(element.tagName)) return false;
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
          });

          report("render-check", {
            visibleElements: visibleElements.length,
            textLength: document.body.innerText.trim().length,
            plotlyCharts: document.querySelectorAll(".js-plotly-plot").length,
            bodyHeight: document.body.scrollHeight
          });
        }, 1500));
      })();
    </script>
    <script>window.uploadedData = ${serializeForInlineScript(uploadedData)};</script>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <script src="https://cdn.plot.ly/plotly-3.0.1.min.js"></script>
    <style>html,body{min-height:100%;margin:0}body{overflow-x:hidden}</style>`;

  if (/<html[\s>]/i.test(generatedHtml)) {
    if (/<head[\s>]/i.test(generatedHtml)) {
      return generatedHtml.replace(/<head([^>]*)>/i, `<head$1>${sandboxHead}`);
    }
    return generatedHtml.replace(/<html([^>]*)>/i, `<html$1><head>${sandboxHead}</head>`);
  }

  return `<!doctype html><html lang="es"><head>${sandboxHead}</head><body>${generatedHtml}</body></html>`;
}

/**
 * Serializa el CSV completo para el iframe local sin permitir que un valor como
 * "</script>" cierre la etiqueta e inyecte marcado adicional.
 */
function serializeForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function openDashboardDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB no está disponible en este navegador."));
      return;
    }

    const request = indexedDB.open(DASHBOARD_DB.name, DASHBOARD_DB.version);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DASHBOARD_DB.store)) {
        database.createObjectStore(DASHBOARD_DB.store);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local."));
  });
}

async function saveDashboardSnapshot(snapshot) {
  const database = await openDashboardDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DASHBOARD_DB.store, "readwrite");
    transaction.objectStore(DASHBOARD_DB.store).put(snapshot, DASHBOARD_DB.lastKey);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("No se pudo guardar el dashboard."));
    };
    transaction.onabort = transaction.onerror;
  });
}

async function readDashboardSnapshot() {
  const database = await openDashboardDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DASHBOARD_DB.store, "readonly");
    const request = transaction.objectStore(DASHBOARD_DB.store).get(DASHBOARD_DB.lastKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("No se pudo recuperar el dashboard."));
    transaction.oncomplete = () => database.close();
  });
}

async function deleteDashboardSnapshot() {
  const database = await openDashboardDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DASHBOARD_DB.store, "readwrite");
    transaction.objectStore(DASHBOARD_DB.store).delete(DASHBOARD_DB.lastKey);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("No se pudo borrar el dashboard guardado."));
    };
  });
}

async function restoreLastDashboard() {
  try {
    const snapshot = await readDashboardSnapshot();
    if (!snapshot?.code || !Array.isArray(snapshot.data) || !snapshot.data.length) return;

    lastDashboard = snapshot;
    parsedRows = snapshot.data;
    currentFileName = snapshot.fileName || "CSV restaurado";
    elements.fileName.textContent = currentFileName;
    elements.fileDetails.textContent = `${formatNumber(parsedRows.length)} registros restaurados del navegador`;
    elements.uploadButton.classList.add("has-file");
    elements.generateButton.disabled = false;
    showDashboardReady(snapshot, true);
    setStatus("Se restauró el último dashboard generado. Puedes verlo o generar uno nuevo.");
  } catch (error) {
    console.warn("No fue posible restaurar el último dashboard:", error);
  }
}

function handleDashboardMessage(event) {
  const message = event.data;
  if (!message || message.channel !== "accounting-dashboard-runtime") return;

  if (message.type === "ready") {
    console.info(`Dashboard · ejecución iniciada con ${formatNumber(message.rows)} filas locales.`);
    return;
  }

  if (message.type === "render-check") {
    console.info("Dashboard · diagnóstico visual:", message);
    if (message.visibleElements === 0) {
      setStatus("Gemini devolvió código, pero no produjo elementos visibles. Revisa el bloque ‘código limpio’ en la consola.", "error");
    }
    return;
  }

  if (message.type === "error") {
    const location = message.line ? ` (línea ${message.line}, columna ${message.column || 0})` : "";
    console.error(`Dashboard generado · ${message.message}${location}`, message);
    setStatus(`Gemini devolvió código, pero falló al ejecutarlo: ${message.message}`, "error");
  }
}

function setGenerating(value) {
  isGenerating = value;
  document.title = value ? "Generando dashboard…" : "Generador de Dashboards Contables";
  elements.welcomePanel.setAttribute("aria-busy", String(value));
  elements.generateButton.disabled = value || !parsedRows.length;
  elements.regenerateButton.disabled = value || !parsedRows.length;
  elements.viewDashboardButton.disabled = value;
  elements.generateButton.querySelector("span").textContent = value ? "Generando…" : "Generar dashboard";
}

function setStatus(message, type = "info") {
  elements.status.textContent = message;
  elements.status.className = "status-message";
  if (type === "error") elements.status.classList.add("is-error");
  if (type === "loading") elements.status.classList.add("is-loading");
}

function normalizeModelName(model) {
  return String(model || "").trim().replace(/^models\//, "");
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-PE").format(value);
}

function humanizeApiError(error) {
  const message = error instanceof Error ? error.message : String(error);

  if (/API key|API_KEY_INVALID|permission/i.test(message)) {
    return "La API Key no es válida o no tiene acceso al modelo. Revísala en Configuración.";
  }
  if (/not found|404/i.test(message)) {
    return "El modelo configurado no está disponible. Actualiza su nombre en Configuración.";
  }
  if (/quota|429|RESOURCE_EXHAUSTED/i.test(message)) {
    return "Se alcanzó el límite de solicitudes o cuota del proveedor seleccionado. Inténtalo más tarde o cambia de proveedor.";
  }
  if (/Failed to fetch|NetworkError/i.test(message)) {
    return "No se pudo conectar con el proveedor seleccionado. Revisa Internet, CORS y las restricciones de tu API Key.";
  }
  return message;
}
