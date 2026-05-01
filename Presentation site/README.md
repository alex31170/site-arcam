# Site de presentation par dossiers

Ce site lit l'arborescence depuis `data.json` et genere les pages avec `script.js`.
Chaque dossier contient un `index.html` minimal qui indique son chemin au script commun.

## Structure

```text
Presentation site/
  index.html
  style.css
  script.js
  data.json
  entete.png
  EXPOSITION.jpg
  EXPOSITION/
    index.html
    2025.png
    2025/
      index.html
      affiche colomiers.jpg
  Peinture/
    index.html
    Inspiration Mer/
      index.html
      Bateau (1).jpg
```

## Exemple de JSON

```json
{
  "title": "Presentation",
  "header": "entete.png",
  "path": "",
  "name": "Accueil",
  "image": null,
  "gallery": ["EXPOSITION.jpg", "PEINTURE.jpg"],
  "children": [
    {
      "name": "EXPOSITION",
      "path": "EXPOSITION",
      "image": "EXPOSITION.jpg",
      "gallery": ["EXPOSITION/2025.png"],
      "children": [
        {
          "name": "2025",
          "path": "EXPOSITION/2025",
          "image": "EXPOSITION/2025.png",
          "gallery": ["EXPOSITION/2025/affiche colomiers.jpg"],
          "children": []
        }
      ]
    }
  ]
}
```

## Mise a jour

Apres ajout, suppression ou renommage de dossiers/images, lancer :

```powershell
.\generate-data.ps1
```

Le site peut etre ouvert directement avec `index.html`. Pour un hebergement web, `data.json` reste aussi disponible, mais `data.js` permet d'eviter les blocages de navigateur en ouverture locale.
