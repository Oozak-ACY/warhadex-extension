# Genere les icones et logos de l extension depuis les originaux de design/logo
# Les originaux restent hors de src : build.mjs copie tout src dans l extension
# Usage : python outils/generer-logos.py (necessite Pillow)
from pathlib import Path
from PIL import Image

RACINE = Path(__file__).resolve().parent.parent
ORIGINAUX = RACINE / 'design' / 'logo'
ICONES = RACINE / 'src' / 'assets' / 'icons'
LOGOS = RACINE / 'src' / 'assets' / 'logo'

# zones mesurees sur les originaux 1024 x 1024, identiques pour les trois variantes
BUSTE = (150, 105, 849, 833)
# en dessous de 48 px le buste devient illisible : seules la casquette et la tete restent
TETE = (370, 100, 730, 460)


def carre(image, zone):
    decoupe = image.crop(zone)
    largeur, hauteur = decoupe.size
    cote = max(largeur, hauteur)
    fond = Image.new('RGBA', (cote, cote))
    fond.paste(decoupe, ((cote - largeur) // 2, (cote - hauteur) // 2))
    return fond


def exporter(image, taille, marge, chemin):
    interieur = taille - 2 * marge
    toile = Image.new('RGBA', (taille, taille))
    toile.paste(image.resize((interieur, interieur), Image.LANCZOS), (marge, marge))
    toile.save(chemin, optimize=True)


def main():
    ICONES.mkdir(parents=True, exist_ok=True)
    LOGOS.mkdir(parents=True, exist_ok=True)

    vert = Image.open(ORIGINAUX / 'logo-vert.webp').convert('RGBA')
    noir = Image.open(ORIGINAUX / 'logo-noir.webp').convert('RGBA')

    tete_verte = carre(vert, TETE)
    buste_vert = carre(vert, BUSTE)
    buste_noir = carre(noir, BUSTE)

    # Chrome recommande une marge transparente autour de l icone 128
    exporter(tete_verte, 16, 0, ICONES / 'icon-16.png')
    exporter(tete_verte, 32, 0, ICONES / 'icon-32.png')
    exporter(buste_vert, 48, 2, ICONES / 'icon-48.png')
    exporter(buste_vert, 128, 12, ICONES / 'icon-128.png')

    # affiches a la moitie de leur taille pour rester nets sur ecran haute densite
    exporter(tete_verte, 56, 0, LOGOS / 'tete-vert-56.png')
    exporter(buste_noir, 128, 0, LOGOS / 'buste-noir-128.png')
    exporter(buste_noir, 320, 0, LOGOS / 'buste-noir-320.png')


if __name__ == '__main__':
    main()
