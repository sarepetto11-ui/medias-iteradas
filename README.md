# Laboratorio de promedios iterados con Yahoo Finance

Conserva el HTML y Plotly incorporado del laboratorio original; no necesita un framework ni CDN.

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

Se elige la última sesión **cerrada con al menos tres cierres válidos para ambos activos**. Puede contener minutos faltantes: se conservan exclusivamente las observaciones originales, sin imputar ni interpolar precios. El JSON y el laboratorio informan la cantidad de cierres y los minutos faltantes; el JSON incluye sus timestamps y la cantidad de precios inválidos descartados. Las capas y el horizonte cuentan observaciones disponibles, no minutos exactos. Duplicados y timestamps fuera de la grilla de minutos impiden seleccionar una sesión. Si no hay datos suficientes se busca una sesión anterior común dentro de los cinco días.

## Abrir sin instalar nada

Después de cada descarga también se genera `laboratorio_listo.html`, con Plotly y las cotizaciones incorporadas. Descargalo y abrilo con doble clic en tu navegador. Podés cambiar activo, capas, borde y horizonte sin conexión. Es una foto de la sesión indicada, no se actualiza sola; para obtener nuevos datos se ejecuta nuevamente `run_lab.py` en el entorno con Python. No hace falta cargar CSV ni iniciar un servidor para esta copia portátil.

Yahoo requiere acceso HTTPS a `query1.finance.yahoo.com`, `query2.finance.yahoo.com`, `fc.yahoo.com` y, según la región, `guce.yahoo.com` y `consent.yahoo.com`. Puede imponer límites o denegar solicitudes. No se deshabilita TLS. La instalación requiere PyPI.

## Interpretación

La recurrencia y los dos bordes originales se conservan hasta 600 capas. Con borde sin extensión y n >= cantidad de cierres no quedan valores definidos. El eje horizontal mide observaciones; el hover de los cierres muestra el timestamp original.

La compensación mueve cada valor de t a t−n/2 sin cambiar su altura. La extrapolación usa la pendiente de los últimos 15 valores definidos y se ancla exactamente en el extremo compensado. Tanto proyección como persistencia se comparan contra los mismos índices enteros estrictamente posteriores al ancla, hasta el horizonte seleccionado o el último cierre disponible. No hay división 80/20. Si no hay pendiente o puntos de contraste, las métricas indican NA.

**Es un contraste retrospectivo con look-ahead declarado**, porque el extremo compensado incorpora datos hasta el final de la sesión aunque se dibuje antes. No prueba capacidad predictiva fuera de muestra. El random walk sin drift se representa mediante su pronóstico central de persistencia, no una trayectoria aleatoria. La tabla informa MAE, RMSE, error absoluto final y ganadores por criterio.

## Validar

```sh
.venv/bin/python -m unittest discover -s tests -v
node tests/test_lab.cjs
```

Las pruebas Python usan datos artificiales exclusivamente como fixtures de validación; nunca se sirven como cotizaciones. Las pruebas JavaScript ejecutan la lógica del HTML con un DOM/Plotly simulado; verifican recurrencia, controles, anclas y muestras comparadas, pero no sustituyen una revisión visual en navegador.

Validación en este entorno: 5 pruebas Python y pruebas JavaScript aprobadas. Descarga real verificada: sesión 2026-10-30, AAPL 390 cierres sin faltantes; GGAL 318 cierres y 72 minutos faltantes. No se rellenaron precios. El bloqueo de red inicial quedó resuelto.

## Random walk con deriva

El tercer panel incluye los pronósticos centrales de persistencia sin deriva y random walk con deriva. Ambos se anclan en el extremo de la curva compensada. La deriva μ es el promedio de los incrementos de los cierres originales desde el inicio de la serie hasta floor(ancla), sin usar cierres posteriores a esa posición. El pronóstico es valor del ancla + μ × (índice − ancla). La deriva cuenta observaciones, no minutos exactos; con menos de dos cierres de historia se informa NA. No se simula ruido.

La tabla compara proyección, RW sin deriva y RW con deriva: cantidad contrastada, MAE, RMSE, error absoluto final, último valor y ganadores por cada criterio (incluye empates). Todos los métodos disponibles usan los mismos cierres posteriores al ancla. Persiste el look-ahead declarado del ancla compensada: esta comparación retrospectiva no demuestra capacidad predictiva fuera de muestra.

El laboratorio muestra tres gráficos. El tercero reúne la proyección y ambos benchmarks. Los controles de capas, borde y horizonte están entre los gráficos 2 y 3 y recalculan todas las vistas y la tabla.
