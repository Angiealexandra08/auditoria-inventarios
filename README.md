# Herramienta de Auditoría de Inventarios

Aplicación web hecha con **HTML, CSS y JavaScript puro** (sin librerías ni servidor) para realizar una auditoría de inventarios: registrar el conteo físico, detectar diferencias contra el sistema, **anexar evidencia** y generar un informe.

## ¿Qué hace?

- **Auditar**: se crea una auditoría (nombre, bodega, fecha, auditor) y se registran los productos con su cantidad en sistema y su cantidad contada. La herramienta calcula la diferencia, el valor monetario y marca cada producto como *Conforme*, *Faltante* o *Sobrante*, además de la exactitud del inventario.
- **Anexar**: a cada producto se le pueden adjuntar fotos o documentos (PDF, Word, Excel) como evidencia, y escribir la observación, causa probable y recomendación. Las imágenes se comprimen automáticamente.
- **Informe**: genera un informe con resumen, detalle del conteo y hallazgos con su evidencia. Se puede imprimir o guardar como PDF.
- **Respaldo**: exportar e importar los datos en un archivo JSON.

## Cómo usarla

1. Descarga o clona este repositorio.
2. Abre `index.html` en el navegador (doble clic). No requiere instalación.
3. Crea una auditoría (o usa **Cargar caso de ejemplo**), agrega productos, anexa evidencia y genera el informe.

Los datos se guardan en el propio navegador (`localStorage`). Exporta un respaldo JSON para no perderlos.

## Fórmulas

- Diferencia = cantidad contada − cantidad en sistema (negativo = faltante, positivo = sobrante)
- Valor de la diferencia = diferencia × costo unitario
- Exactitud del inventario = (productos sin diferencia ÷ productos contados) × 100

## Estructura del proyecto

| Archivo | Función |
|---|---|
| `index.html` | Estructura de la página: formularios, tabla de productos e informe. |
| `style.css` | Estilos de la aplicación y de la vista de impresión del informe. |
| `app.js` | Lógica: cálculo de diferencias, anexos, informe, almacenamiento y respaldo. |
| `README.md` | Descripción del proyecto e instrucciones de uso. |

## Caso de ejemplo

Ferretería «El Constructor»: 5 productos, 2 conformes, 2 con faltante y 1 con sobrante. Exactitud 40 %, faltantes −$148.00, sobrantes +$11.25, diferencia neta −$136.75.

## Autoras

Angelina Alexandra Arévalo Ortiz, Neysi Yaneli Durán Aguilar y Milagro de los Ángeles Zeledón Ortiz — 3° ITSI, sección «A». Instituto Nacional de El Congo (INCO).
