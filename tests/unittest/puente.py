"""Ayuda compartida de las pruebas unittest: ejecuta el código JavaScript real
del proyecto con Node (Firebase simulado) y devuelve el resultado como Python.

Uso desde la raíz del repo:  python -m unittest discover -s tests/unittest -v
"""
import json
import pathlib
import subprocess

RAIZ = pathlib.Path(__file__).resolve().parents[2]
PUENTE = RAIZ / 'tests' / 'unittest' / 'puente.mjs'


def ejecutar_js(imports, codigo):
    """imports: {'Alias': 'js/ruta.js'}; codigo: cuerpo de una función async que hace `return`."""
    proceso = subprocess.run(
        ['node', str(PUENTE)],
        input=json.dumps({'imports': imports, 'codigo': codigo}),
        capture_output=True, text=True, encoding='utf-8', cwd=RAIZ, timeout=60,
    )
    if proceso.returncode != 0:
        raise AssertionError(f'Node terminó con error:\n{proceso.stderr}')
    return json.loads(proceso.stdout.strip().splitlines()[-1])


def leer(ruta):
    """Lee un archivo del repo como texto (para pruebas estáticas)."""
    return (RAIZ / ruta).read_text(encoding='utf-8')
