# Release Prozess

## Versionsverwaltung

In diesem Projekt wird generell für Major versionen mit release Branches und Tags für minor versionen gearbeitet.

### Neue Major version

Neuen branch vom master `release/v.x`.

Weil ein separater branch gebraucht wird, kann in Zukunft wenn beirets eine version 3.x existiert auf einfache Art und weise eine neue minor version 2.x erstellt werden auf dem release/2.x branch.

Zusätzlich muss nach dem Erstellen des neuen Major Branches wie bei einem Minor release auch ein Tag erstellt werden.

### Neue Minor version

Minor versionen werden nur durch tags erstellt auf dem release Branch, zu welcher Major Version dieses Release gehört.

Ablauf:

- Master auf bestehenden release branch mergen
- Version in `package.json` aktualisieren
- commit und push
- `git tag -a vX.X.X -m "nachricht"`
- `git push origin vX.X.X`
- In Gitlab neuer Release erstellen mit Tag und Release Notes