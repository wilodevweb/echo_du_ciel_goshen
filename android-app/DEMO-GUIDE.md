# Guide de test — démo mobile Goshen

Ce guide décrit les valeurs fictives à saisir dans l’application mobile lancée avec `goshen-dev`. Les données sont stockées dans la base locale `.goshen-demo/goshen.db` et sont séparées de la base réelle.

## Comptes de démonstration

| Rôle | Identifiant | Mot de passe |
| --- | --- | --- |
| Administrateur | `demo.admin` | `demo1234` |
| Moniteur | `demo.monitor` | `demo1234` |

Sur l’écran **Connexion**, saisis l’identifiant complet dans **Nom ou identifiant** et laisse **Postnom** et **Prénom** vides. Appuie sur **Continuer**, puis saisis le mot de passe. Le compte administrateur permet de tester les fonctions de gestion; le compte moniteur permet de tester les fonctions courantes.

## Écrans et champs

### Accueil

Il n’y a pas de formulaire à remplir. L’écran affiche les enfants et les raccourcis.

| Champ ou action | Valeur de test |
| --- | --- |
| Recherche d’un enfant ou parent | `Amani`, `Mukendi` ou `Parent Mukendi` |
| Filtre de classe | `Toutes`, `1ère`, `2e` ou `3e` |
| Faire l’appel | Ouvre l’écran de présence |
| Ajouter un enfant | Ouvre le formulaire d’enfant |
| Menu du profil | Ouvre l’annuaire, les familles, les événements, les archives, les notifications et, pour l’administrateur, l’administration |

### Faire l’appel

Il n’y a pas de texte à saisir. Choisis une classe, puis appuie sur un statut sous le nom d’un enfant. Les statuts proposés sont **Présent**, **Absent** et **Malade**. Les flèches permettent de changer de dimanche; l’enregistrement est automatique.

Exemple : sélectionne **1ère classe**, puis marque **Amani Mukendi** comme **Présent** et **Béni Kalala** comme **Absent**.

### Annuaire — ajouter ou modifier un enfant

Dans l’annuaire, utilise **＋ Ajouter un enfant**. Les champs requis sont le prénom et le nom.

| Champ | Valeur fictive à saisir |
| --- | --- |
| Prénom * | `Lina` |
| Nom * | `Mbuyi` |
| Postnom | `Kanku` |
| Classe | `1ère` |
| Genre | `Fille` |
| Parent / responsable | `Marie Mbuyi` |
| Téléphone | `+243 900 123 456` |
| Adresse | `Quartier Démo, Lubumbashi` |
| Date de naissance | `2017-04-12` (format `AAAA-MM-JJ`) |
| Notes | `DOSSIER FICTIF — test mobile` |
| Photo | Facultative; choisir une image sur le téléphone |

Appuie sur **Enregistrer**. Pour retrouver l’enfant, saisis `Lina` dans la recherche. Pour modifier ou archiver un enfant existant, ouvre sa fiche.

### Familles

Cet écran n’a pas de formulaire de création. Les familles sont regroupées à partir des champs **Parent / responsable**, **Téléphone** et **Adresse** des fiches enfants. Recherche par `Marie Mbuyi`, `Lina` ou `+243 900 123 456` après avoir enregistré l’exemple ci-dessus.

### Événements et tâches — administrateur

Dans **Événements**, appuie sur **＋ Nouvel événement**.

| Champ | Valeur de test |
| --- | --- |
| Nom de l’événement | `Répétition démo` |
| Date | Date voulue au format `AAAA-MM-JJ`, par exemple `2026-10-18` |
| Description (facultative) | `Préparation fictive du programme` |

Appuie sur **Créer**, puis ouvre l’événement et choisis **＋ Assigner des tâches**.

| Champ ou choix | Valeur de test |
| --- | --- |
| Intitulé de la tâche | `Apprendre le chant démo` |
| Type | `Chant` (ou Poème, Émission, Sketch, Théâtre, Autre) |
| Classe cible | `1ère` (ou 2e, 3e, Toutes) |
| Enfants | Recherche `Lina` ou sélectionne un enfant fictif de la classe |

Appuie sur **Assigner**. Ouvre ensuite l’événement et touche la tâche pour la marquer terminée ou non terminée.

### Notifications

Cet écran ne comporte pas de champs à saisir. Il regroupe les alertes d’anniversaire, d’absences prolongées, de maladie et de profils sans téléphone. Le compte administrateur peut appliquer les propositions de changement de classe ou d’archivage lorsqu’elles sont affichées.

### Archives médias

La recherche et les filtres ne modifient pas les données.

| Champ ou choix | Valeur de test |
| --- | --- |
| Rechercher une ressource | `Ressource de démonstration` |
| Filtre | Toutes, Image, Vidéo ou PDF |
| Titre du fichier (facultatif, administrateur) | `Affiche démo` |
| Format d’aperçu | `Carré`, `Large` ou `Portrait` |
| Fichier | Choisir une image, une vidéo ou un PDF fictif sur le téléphone |

Le type de ressource est détecté à partir du fichier choisi. Appuie sur **＋ Ajouter un fichier** pour l’envoyer.

### Administration — administrateur

Dans **Administration**, appuie sur **＋ Ajouter un compte**. Le mot de passe du nouveau compte doit contenir au moins 12 caractères.

| Champ | Valeur fictive à saisir |
| --- | --- |
| Nom complet | `Moniteur Test Démo` |
| Identifiant (facultatif) | `demo.moniteur.test` |
| Titre / statut | `Moniteur` |
| Mot de passe | `GoshenDemo2026!` |

Appuie sur **Créer le compte moniteur**. Les comptes `demo.admin` et `demo.monitor` sont des comptes de démonstration déjà fournis; ne les recrée pas.

## Données déjà présentes

La démo contient 70 enfants fictifs, des présences d’exemple, l’événement **École du dimanche** et une ressource **Ressource de démonstration**. Les changements effectués dans cette base locale sont conservés entre les lancements de la démo.
