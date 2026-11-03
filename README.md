# Laboratorio de promedios iterados con Yahoo Finance

Conserva el HTML y Plotly incorporado del laboratorio original; no necesita un framework ni CDN.

## Descargar y abrir sin programar

Descargá [laboratorio_descargable.zip](https://github.com/sarepetto11-ui/medias-iteradas/raw/refs/heads/main/laboratorio_descargable.zip), extraelo y abrí `laboratorio_listo.html` con doble clic en Chrome, Edge o Firefox. El selector superior permite elegir **Laboratorio retrospectivo** o **Experimento predictivo**. No hace falta instalar Python. El ZIP incluye las dos pestañas de datos y se regenera al actualizar cotizaciones; la copia descargada no se actualiza sola. Las fechas disponibles se muestran en pantalla. GitHub no ejecuta el HTML en su vista de código.

## Ejecutar

Python 3.10 o posterior:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python run_lab.py
```

En Windows usar `.venv\Scripts\python.exe`. En máquinas sin navegador: `run_lab.py --no-browser`. Puerto configurable con `--port 8001`. El comando actualiza los datos antes de abrir/servir el laboratorio. Ctrl+C detiene el servidor. No se inicia el servidor si falla la descarga, para evitar confundir datos antiguos con nuevos.

`fetch_market_data.py` también puede ejecutarse solo. Genera atómicamente `market_data.json` (ignorado por Git), con timestamps ISO 8601 y zona/offset de Nueva York, cierres y metadatos de validación. No hay precios sintéticos por defecto. Se conserva la carga manual de CSV como alternativa.

## Datos y sesiones

AAPL y GGAL, `period=5d`, `interval=1m`, `prepost=False`, `auto_adjust=False`, `repair=False`, campo `Close` original. No se redondean ni ajustan los precios. Calendario NYSE para la sesión regular de acciones estadounidenses (incluye feriados y cierres anticipados, coincidentes con estos instrumentos de NASDAQ). Los timestamps de Yahoo identifican el inicio de cada barra de un minuto.

Se elige el par más reciente de sesiones **cerradas, consecutivas en el calendario y con al menos tres cierres válidos por sesión para ambos activos**. El retrospectivo recibe solo la segunda; el predictivo concatena ambas conservando sus límites. Puede haber minutos faltantes: se mantienen exclusivamente las observaciones originales, sin imputar ni interpolar precios. El JSON informa sus timestamps y la cantidad de precios inválidos descartados. Las capas y el horizonte cuentan observaciones disponibles, no minutos exactos. Duplicados y timestamps fuera de la grilla de minutos impiden seleccionar una sesión. Si no hay un par válido dentro de los cinco días, la actualización informa un error.

## Abrir sin instalar nada

Después de cada descarga también se genera `laboratorio_listo.html`, con Plotly y las cotizaciones incorporadas. Descargalo y abrilo con doble clic en tu navegador. Podés cambiar activo, capas, borde y horizonte sin conexión. Es una foto de la sesión indicada, no se actualiza sola; para obtener nuevos datos se ejecuta nuevamente `run_lab.py` en el entorno con Python. No hace falta cargar CSV ni iniciar un servidor para esta copia portátil.

Yahoo requiere acceso HTTPS a `query1.finance.yahoo.com`, `query2.finance.yahoo.com`, `fc.yahoo.com` y, según la región, `guce.yahoo.com` y `consent.yahoo.com`. Puede imponer límites o denegar solicitudes. No se deshabilita TLS. La instalación requiere PyPI.

## Interpretación del laboratorio retrospectivo

La recurrencia y los dos bordes originales se conservan hasta 600 capas. Con borde sin extensión y n >= cantidad de cierres no quedan valores definidos. El eje horizontal mide observaciones; el hover de los cierres muestra el timestamp original.

La compensación mueve cada valor de t a t−n/2 sin cambiar su altura. La extrapolación usa la pendiente de los últimos 15 valores definidos y se ancla exactamente en el extremo compensado. Tanto proyección como persistencia se comparan contra los mismos índices enteros estrictamente posteriores al ancla, hasta el horizonte seleccionado o el último cierre disponible. No hay división 80/20. Si no hay pendiente o puntos de contraste, las métricas indican NA.

**Es un contraste retrospectivo con look-ahead declarado**, porque el extremo compensado incorpora datos hasta el final de la sesión aunque se dibuje antes. No prueba capacidad predictiva fuera de muestra. El random walk sin drift se representa mediante su pronóstico central de persistencia, no una trayectoria aleatoria. La tabla informa MAE, RMSE, error absoluto final y ganadores por criterio.

## Validar

```sh
.venv/bin/python -m unittest discover -s tests -v
node tests/test_lab.cjs
```

Las pruebas Python usan datos artificiales exclusivamente como fixtures de validación; nunca se sirven como cotizaciones. Las pruebas JavaScript ejecutan la lógica del HTML con un DOM/Plotly simulado; verifican recurrencia, controles, anclas y muestras comparadas, pero no sustituyen una revisión visual en navegador.

Validación de esta versión: 9 pruebas Python, 11 pruebas unitarias predictivas, regresión JavaScript retrospectiva y 2 pruebas de navegador (HTTP y archivo portátil) aprobadas. Descarga real verificada para las sesiones 2026-10-29 y 2026-10-30: AAPL 390/390 cierres y 0/0 minutos faltantes; GGAL 334/318 cierres y 56/72 minutos faltantes. No se rellenaron precios.

## Random walk con deriva (retrospectivo)

El tercer panel incluye los pronósticos centrales de persistencia sin deriva y random walk con deriva. Ambos se anclan en el extremo de la curva compensada. La deriva μ es el promedio de los incrementos de los cierres originales desde el inicio de la serie hasta floor(ancla), sin usar cierres posteriores a esa posición. El pronóstico es valor del ancla + μ × (índice − ancla). La deriva cuenta observaciones, no minutos exactos; con menos de dos cierres de historia se informa NA. No se simula ruido.

La tabla compara proyección, RW sin deriva y RW con deriva: cantidad contrastada, MAE, RMSE, error absoluto final, último valor y ganadores por cada criterio (incluye empates). Todos los métodos disponibles usan los mismos cierres posteriores al ancla. Persiste el look-ahead declarado del ancla compensada: esta comparación retrospectiva no demuestra capacidad predictiva fuera de muestra.

El laboratorio muestra tres gráficos. El tercero reúne la proyección y ambos benchmarks. Los controles de capas, borde y horizonte están entre los gráficos 2 y 3 y recalculan todas las vistas y la tabla.

## Experimento predictivo (modalidad independiente)

Abrí `laboratorio_listo.html` con doble clic y elegí **Experimento predictivo** en el selector superior. Para actualizar datos y servir ambos modos, el comando sigue siendo `.venv/bin/python run_lab.py` (opcional `--no-browser`). La copia portátil incluye todo el JavaScript y los datos, sin CDN. El laboratorio retrospectivo conserva sus tres gráficos, controles y cálculos y utiliza solo la sesión más reciente; la nueva modalidad usa ambas sesiones.

### Reproducción y datos

La descarga ahora exige dos sesiones **consecutivas en el calendario bursátil**, cerradas y comunes a ambos símbolos, dentro de `period=5d`. No se salta una sesión bursátil entera sin datos para formar el par. Se respetan feriados y cierres anticipados; se conserva la política autorizada de no rellenar minutos faltantes. `market_data.json` mantiene `instruments` para el retrospectivo y añade `predictive`, con fechas, metadatos por sesión, observaciones concatenadas y `second_session_start` por activo. El límite entre sesiones es explícito; el salto nocturno participa como un incremento entre observaciones. No se interpreta como un minuto consecutivo.

1. Elegí activo, capas n, horizonte H y borde.
2. Mové **Origen en sesión 2** para avanzar por sus cierres. El timestamp, índice y precio de origen se muestran junto a los controles.
3. En **Pronóstico**, únicamente se dibujan precios conocidos hasta t y los pronósticos. El gráfico de pendientes muestra solo estimaciones. Los resultados futuros permanecen ocultos.
4. Cambiá a **Evaluación posterior** para revelar, por separado, cierres futuros y suavizado realizado. La tabla informa resultados completos, pendientes o no evaluables.
5. **Evaluar todos los orígenes con estos parámetros** reproduce cronológicamente toda la segunda sesión. Las tres técnicas se comparan sobre idénticas ventanas completas. Cambiá n y H para explorar otras celdas E(n,H); no hay optimización automática. La API pura `Predictive.grid` permite evaluar listas explícitas de n/H.
6. **Descargar registro de pronósticos emitidos** guarda un JSON con el origen, timestamp, historia usada, parámetros, pendientes y trayectorias originales. Los registros se conservan en memoria durante la apertura y no se sobrescriben al conocer resultados. Descargalos antes de cerrar para conservarlos; no hay almacenamiento automático entre aperturas.

### Qué se pronostica

Los tres métodos parten **exactamente de Pₜ**, el último cierre conocido: P̂(t+h)=Pₜ+s·h, h=0…H. No se usa el extremo compensado como origen y no hay puentes polinomiales.

- **RW sin deriva:** s=0, persistencia del cierre conocido.
- **RW con deriva:** s=(Pₜ−P₀)/t, equivalente al promedio de todos los incrementos desde la primera observación de la primera sesión hasta t. Incluye el salto entre sesiones; no es una tasa por minuto físico.
- **Pendiente suavizada:** se aplica el mismo filtro iterado al prefijo P₀…Pₜ con el borde elegido. Se ajusta una recta a los últimos 15 valores definidos (mínimo 3), en las coordenadas i−n/2. Esa pendiente se extrapola desde Pₜ. Si no está definida se conserva `null`/NA, sin reemplazarla por cero.

Las proyecciones son pronósticos centrales, no trayectorias simuladas con ruido. El motor `predictive_engine.js` recibe explícitamente un prefijo para emitir un pronóstico. No recibe los precios futuros. Los objetos se congelan recursivamente y la evaluación produce un resultado separado; modificar o extender datos no reescribe un pronóstico ya emitido.

### Referencia posterior y disponibilidad

Sₙ(x) es el filtro de medias iteradas desplazado n/2 a la izquierda. Para x entero se consulta el filtro en u=x+n/2. Si n es impar, u es semientero: se promedian los dos valores **suavizados** vecinos, que deben estar ya observados y definidos. No se interpolan precios originales faltantes.

La ventana de origen t y horizonte H solo se evalúa si existen observaciones hasta **ceil(t+H+n/2)** inclusive. Si faltan, queda **pendiente**; si falta historial para el borde o una pendiente de algún modelo es NA, queda **no evaluable** para todos. No se presentan horizontes parciales como evaluaciones válidas. La evaluación usa solo el prefijo necesario para completar esa referencia, aunque haya más datos disponibles.

Pendiente realizada: βreal=[Sₙ(t+H)−Sₙ(t)]/H. Se muestran error firmado s−βreal, error absoluto y acierto de signo. Cero es una tercera dirección y solo acierta contra cero exacto, sin tolerancia. La tabla agregada promedia errores absolutos de pendiente y aciertos.

La trayectoria se compara contra Sₙ(t+h) para **h=1…H**, excluyendo el ancla. MAE y RMSE tienen unidades de precio, separadas del error de pendiente (precio/observación). El agregado calcula MAE sobre todas las ventanas comunes y RMSE como raíz del promedio de errores cuadrados de sus trayectorias, no promedio de raíces. Cada ventana tiene el mismo H.

El suavizado realizado contiene información posterior y se usa **exclusivamente como objetivo de evaluación**. No entra en la estimación histórica ni desplaza el origen. Esto elimina el look-ahead en los pronósticos; el objetivo solo se conoce después del horizonte más el retraso del suavizado.

### Límites de interpretación

Son dos sesiones, con ventanas solapadas y datos faltantes; las métricas no son pruebas de significancia ni resultados operables en vivo. Elegir parámetros mirando esta segunda sesión no constituye validación independiente: hace falta otra muestra para confirmarlos. No se ajustan combinaciones ponderadas, indicadores de consenso ni polinomios. Se evalúa la curva suavizada, no un precio ejecutable, y no se incluye aquí una segunda evaluación contra cierres originales.

### Pruebas adicionales

```sh
node tests/test_predictive.cjs
node tests/test_lab.cjs
.venv/bin/python -m unittest discover -s tests -v
```

`test_predictive.cjs` verifica independencia de precios futuros, anclas Pₜ, inmutabilidad, disponibilidad de referencias pares/impares, pendientes y métricas analíticas, NA, signos y ventanas comunes, y E(n,H). Los tests originales verifican la regresión del laboratorio retrospectivo. Las fixtures artificiales de pruebas no se usan como cotizaciones.

Para la prueba de navegador opcional (requiere Playwright y Chromium instalados): `node tests/test_browser.cjs`. Verifica el HTML servido y la copia portátil, aislamiento de modos, controles, registro, evaluación pendiente y reproducción completa.


## Pestañas de datos: intradiarios y diarios

Arriba del laboratorio se puede elegir **Datos intradiarios** o **Datos diarios**, en ambos modos. Los controles y cálculos se mantienen. Los CSV cargados manualmente se conservan por pestaña mientras el archivo siga abierto. Las muestras se ordenan de la más antigua a la más reciente para calcular correctamente los filtros.

- **Intradiarios:** cierres de un minuto de las dos últimas sesiones regulares consecutivas cerradas. El retrospectivo muestra la última sesión y el predictivo inicializa con la anterior.
- **Diarios:** una ventana de **un año calendario hacia atrás desde el último cierre completo disponible de cada activo**. Se descargan dos años con `interval=1d` para poder recortar exactamente ese año, aunque el último cierre sea anterior a hoy. El calendario excluye la sesión en curso hasta que cierre; respeta fines de semana, feriados y cierres anticipados. El límite izquierdo del año es inclusivo. Se conservan timestamps de Yahoo (en barras diarias representan la fecha de sesión, no la hora efectiva del cierre), precios `Close` sin ajustes y sesiones faltantes, sin rellenar ni interpolar.

En la pestaña diaria cada paso corresponde a una sesión observada, no a un día calendario. El retrospectivo muestra todo el año. En el **experimento predictivo diario** la primera mitad cronológica (floor(N/2) observaciones) inicializa la historia y la segunda emite pronósticos sucesivos; el gráfico marca ese límite. Esta división no cambia las dos sesiones del intradiario. Las proyecciones siguen partiendo de Pₜ y no usan precios posteriores al origen. Los registros de pronósticos diarios e intradiarios están separados y la exportación indica su frecuencia, para evitar mezclar las dos muestras. Cambiar de pestaña no sobrescribe los registros ya emitidos.

El JSON añade `daily.instruments`, con inicio del año solicitado, primera y última sesión observada, observaciones originales, cantidad esperada, sesiones faltantes y descartes inválidos. La muestra diaria se valida por separado de los minutos intradiarios.

Validación de esta actualización: ambos activos tienen **251 cierres diarios del 2025-11-03 al 2026-11-02**, sin sesiones faltantes. Se descargaron también las sesiones intradiarias 2026-10-30 y 2026-11-02. Estos valores describen la copia generada en esta actualización, no una cotización en vivo.

Pruebas: `tests/test_daily.py` verifica año calendario (incluido año bisiesto), exclusión de sesiones abiertas, huecos sin rellenar, precios originales, duplicados e historia insuficiente. La prueba de navegador comprueba ambas pestañas, activos, modos, regreso al intradiario y funcionamiento del archivo portátil. `build_portable` regenera automáticamente el HTML y el ZIP descargable después de cada actualización.
