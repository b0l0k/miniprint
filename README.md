# MiniPrint

Atelier web pour **créer** et **imprimer** des photos sur une [Canon Zoemini 2](https://www.canon.fr/) (Ivy 2 Mini), **sans l’application mobile** et **sans Python**.

Made by **b0l0k** for his ♥ daughter.

Démo : [b0l0k.github.io/miniprint](https://b0l0k.github.io/miniprint/)

---

## Fonctionnalités

| Zone | Contenu |
| --- | --- |
| **Collages** | 1 / 2 / 3 / 4 photos, bande, motifs de fond |
| **Stickers** | Stickers + emojis |
| **Cadres** | Cadres polaroid / décoratifs |
| **Effets** | Tons couleur (Golden Hour, Vintage, Paillettes…) |
| **Lumière** | luminosité, contraste, saturation, chaleur, vignette |
| **Texte** | polices décoratives, couleurs, taille, rotation |
| **Impression** | Bluetooth Classic via Web Serial (Chrome / Edge) |

---

## Prérequis

### Création (éditeur)

- N’importe quel navigateur moderne suffit pour composer.

### Impression

1. **Chrome** ou **Edge** desktop (pas Firefox / Safari pour le Bluetooth série)
2. Imprimante **appairée** dans les réglages Bluetooth (Windows / ChromeOS)  
   Nom typique : `Canon (xx:xx) Mini Printer`
3. Page ouverte en `http://localhost…` (ou HTTPS)
4. Sous **WSL** : ouvrir l’URL dans **Chrome Windows** (le Bluetooth WSL n’existe pas)

---

## Démarrage rapide

```bash
cd miniprintweb
python3 -c "
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
ThreadingHTTPServer(('0.0.0.0', 5173), SimpleHTTPRequestHandler).serve_forever()
"
```

Puis ouvre : [http://localhost:5173/](http://localhost:5173/)

> Astuce WSL : si `localhost` ne répond pas depuis Windows, utilise l’IP WSL  
> (`hostname -I`) → ex. `http://172.x.x.x:5173/`

---

## Utilisation

1. Choisis un **collage**, clique une case → ajoute une photo  
2. Ajoute **stickers**, un **cadre**, un **effet**, du **texte**  
3. Ajuste la **lumière** et le **cadrage** (Ajuster / Remplir / Étirer) si besoin  
4. Clique **Bluetooth** → choisis le port Canon / COMx  
5. **Imprimer**

### Texte sélectionné

Quand un texte est sélectionné, le panneau affiche :

- modification du contenu  
- choix de **police**  
- **couleur** et **taille**  
- − / ＋ / rotation / supprimer  

### Photo sélectionnée

- **Ajuster** (défaut) : image entière, sans déformer  
- **Remplir** : cadre plein — glisse pour recadrer  
- **Étirer** : force le cadre  

---

## Architecture technique

```
miniprintweb/
├── index.html              # UI atelier
├── css/
│   ├── app.css             # thème « candy »
│   └── fonts.css           # @font-face
├── js/
│   ├── main.js             # orchestration UI + print
│   ├── studio.js           # éditeur canvas (collages, stickers…)
│   ├── filters.js          # lumière + effets
│   ├── image.js            # pipeline JPEG imprimante
│   ├── printer.js          # Web Serial RFCOMM
│   └── protocol.js         # framing ivy2 / Printer2
└── assets/canon/           # cadres, stickers, effets, motifs, polices
    ├── frames/ stickers/ color_tones/ patterns/ fonts/
    └── catalog.json
```

### Bluetooth : pourquoi Web Serial (pas Web Bluetooth) ?

Le protocole Zoemini / Ivy 2 (voir [ivy2](https://github.com/dtgreene/ivy2)) passe par **Bluetooth Classic RFCOMM / SPP** :

- UUID SPP : `00001101-0000-1000-8000-00805f9b34fb`
- **Web Bluetooth** = BLE seulement → inutilisable ici  
- **Web Serial** (Chrome 117+) = RFCOMM dans le navigateur → bon chemin

### Protocole d’impression

Inspiré d’ivy2 + constat live sur Zoemini 2 :

| Élément | Valeur |
| --- | --- |
| Requête magic | `0x430F` |
| Réponse magic | `0x43F0` |
| Session / status / print ready | commandes Printer2 |
| Image finale | JPEG **640×1616**, rotation 180° |
| Transfert | chunks de **990** octets |

Flow : `StartSession` → `GetStatus` → `GetSetting` → `PrintReady` → envoi JPEG → ACK.

---

## Dépannage

| Symptôme | Piste |
| --- | --- |
| Page lente / figée | Recharger fort (`Ctrl+Shift+R`) ; serveur multi-thread recommandé |
| `localhost` KO sous Windows+WSL | Utiliser l’IP WSL |
| « user gesture » / double invite | Un seul clic Connecter ; ne pas enchaîner deux `requestPort` |
| Timeout handshake, LED fixe | Lien RFCOMM OK ; vérifier le magic réponse `43 f0` dans le journal |
| « Failed to open serial port » | Attendre 2 s, déconnecter puis reconnecter ; fermer toute autre appli d’impression |
| Bouton Imprimer grisé / pas de clic | Vérifier handshake OK ; éviter overlay fichier sur le bouton |

---

## Crédits

- Protocole de référence : [dtgreene/ivy2](https://github.com/dtgreene/ivy2)
- Made by **b0l0k** for his ♥ daughter

---

## Licence / usage

Projet personnel / familial.
