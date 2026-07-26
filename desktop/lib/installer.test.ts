import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

function macro(source: string, name: string) {
    const match = new RegExp(`!macro ${name}\\b([\\s\\S]*?)!macroend`).exec(source);
    if (!match) throw new Error(`Missing NSIS macro: ${name}`);
    return match[1];
}

describe('Windows installer update safety', () => {
    it('keeps optional setup available without disabling existing preferences', async () => {
        const source = await readFile('desktop/installer.nsh', 'utf8');
        const install = macro(source, 'customInstall');
        expect(source).toContain('Page custom StartEventsPageCreate StartEventsPageLeave');
        expect(source).toContain('Page custom IntelliSensePageCreate IntelliSensePageLeave');
        expect(install).toContain('ai-model.ps1" -Enable');
        expect(install).not.toContain('ai-model.ps1" -Disable');
        expect(install).toContain('intellisense.ps1" -Install');
        expect(install).not.toContain('intellisense.ps1" -Disable');
        expect(install).toContain('${If} $CodeGateExistingInstall == 1');
        expect(install).toContain('-Install -Languages "$IntelliSenseLanguages"\'');
        expect(install).toContain('-Install -Languages "$IntelliSenseLanguages" -SettingsPath');
        expect(source).not.toContain('${isUpdated}');
    });

    it('does not run full cleanup during an in-place update', async () => {
        const source = await readFile('desktop/installer.nsh', 'utf8');
        const uninstall = macro(source, 'customUnInstall');
        expect(uninstall).toContain('${If} $CodeGateUninstallIsUpdate == 0');
        expect(uninstall.indexOf('${If} $CodeGateUninstallIsUpdate == 0')).toBeLessThan(uninstall.indexOf('start-events.ps1'));
        expect(uninstall.indexOf('${If} $CodeGateUninstallIsUpdate == 0')).toBeLessThan(uninstall.indexOf('ai-model.ps1'));
        expect(uninstall.indexOf('${If} $CodeGateUninstallIsUpdate == 0')).toBeLessThan(uninstall.indexOf('intellisense.ps1'));
        expect(uninstall.indexOf('${If} $CodeGateUninstallIsUpdate == 0')).toBeLessThan(uninstall.indexOf('RMDir /r "$APPDATA\\CodeGate"'));
        expect(source).toMatch(/\$\{GetOptions\} \$R0 "--updated" \$R1/);
    });
});
