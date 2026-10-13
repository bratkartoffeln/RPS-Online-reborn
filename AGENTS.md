# Projektregeln für KI-Agenten

Diese Datei liegt bewusst im Projektstamm: Hier finden Codex und kompatible KI-Agenten die projektweiten Anweisungen. Für GitHub Copilot in VS Code verweist `.github/copilot-instructions.md` auf diese zentrale Regeldatei.

## Branch und Projektversion vor Quellcodeänderungen

- Vor jeder Quellcodeänderung den aktiven Git-Branch und die aktuelle Projektversion in `package.json` prüfen.
- Ist der aktive Branch `main`, vor der ersten Quellcodeänderung einen neuen Versionsbranch erstellen und auf diesen wechseln. Dafür die Patch-Versionsnummer um eins erhöhen: beispielsweise von `0.4.7` auf `0.4.8`. Der Branch heißt exakt wie die neue Version, ohne Präfix.
- Einen bereits vorhandenen gleichnamigen Branch nicht überschreiben oder löschen. In diesem Fall die nächste freie höhere Patch-Version als Branch und Projektversion verwenden.
- Auf dem neuen Branch die Version in `package.json` sowie in `package-lock.json` (oberstes `version` und `packages[""].version`) auf dieselbe neue Versionsnummer setzen. Aktuelle Versionsangaben in der Projektdokumentation entsprechend aktualisieren; historische Versionsangaben und Changelog-Einträge beibehalten.
- Frontend und Server beziehen ihre Versionsnummer bereits aus `package.json`; diese gemeinsame Versionsquelle beibehalten.
- Erst danach die angeforderten Quellcodeänderungen durchführen. Quellcode nicht direkt auf `main` ändern.
- Ist bereits ein anderer Branch aktiv, verursacht diese Regel allein keinen weiteren Branchwechsel oder Versionssprung.
- Reine Dokumentations- oder Regeländerungen ohne Quellcodeänderung erfordern keinen Versionsbranch und keinen Versionssprung.
