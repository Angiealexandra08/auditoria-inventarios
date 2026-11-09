# Herramienta de Auditoría de Inventarios

Aplicación web hecha con **HTML, CSS y JavaScript puro** (sin librerías ni servidor) para realizar una auditoría de inventarios: registrar el conteo físico, detectar diferencias contra el sistema, **anexar evidencia** y generar un informe.

## ¿Qué hace?

- **Auditar:** se crea una auditoría (nombre, bodega, fecha, auditor) y se registran los productos con su cantidad en sistema y su cantidad contada. La herramienta calcula la diferencia, el valor monetario y marca cada producto como *Conforme*, *Faltante* o *Sobrante*.
- **Anexar:** a cada producto se le pueden adjuntar fotos o documentos (PDF, Word, Excel) como evidencia. Las imágenes se comprimen automáticamente.
- **Informe:** genera un informe con resumen, detalle del conteo y hallazgos con su evidencia. Se puede imprimir o guardar como PDF.
- **Respaldo:** exportar e importar los datos en un archivo JSON.

## Cómo usarla

1. Descarga o clona este repositorio.
2. Abre `index.html` en el navegador (doble clic). No requiere instalación.
3. Crea una auditoría, agrega productos, anexa evidencia y genera el informe.

Los datos se guardan en el navegador (`localStorage`). Usa **Exportar respaldo** para no perderlos.

## Estructura

```
auditoria-inventarios/
├── index.html   # estructura de la página
├── style.css    # estilos (incluye vista de impresión)
├── app.js       # lógica: auditoría, anexos, informe, respaldo
└── README.md
```

## Ejemplo rápido

| Código  | Producto           | Sistema | Contado | Diferencia | Estado   |
|---------|--------------------|---------|---------|------------|----------|
| CEM-001 | Saco de cemento    | 100     | 92      | -8         | Faltante |
| VAR-010 | Varilla 3/8"       | 50      | 50      | 0          | Conforme |
| CLA-005 | Caja de clavos     | 20      | 23      | +3         | Sobrante |

## Autor

Proyecto académico — Auditoría de inventarios.
