# Générateur de galeries

Ce script parcourt les dossiers racines du projet (exclut `site/`), copie les images
dans `site/assets/<slug>/original` et génère des vignettes dans `site/assets/<slug>/thumbs`,
puis met à jour les pages HTML (`site/<slug>.html`) en injectant la galerie.

Installation des dépendances:

```powershell
cd d:\dev\siteAlex\site
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

Exécution:

```powershell
python generate_galleries.py
```
