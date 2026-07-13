import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function reference(problemId: string, language: 'python' | 'cpp' = 'python') {
    const problemRoot = path.join(process.cwd(), 'problems', problemId);
    const config = JSON.parse(fs.readFileSync(path.join(problemRoot, 'codegate.json'), 'utf8'));
    return fs.readFileSync(path.join(problemRoot, config.languages[language].reference), 'utf8');
}

function bindingFrom(page: Page) {
    const url = new URL(page.url());
    return {
        sessionId: url.searchParams.get('sessionId')!,
        challengeId: url.searchParams.get('challengeId')!,
        scaffold: url.searchParams.get('scaffold')!
    };
}

async function poll(page: Page, jobId: string) {
    for (let attempt = 0; attempt < 100; attempt++) {
        const response = await page.request.get(`/api/submit?jobId=${encodeURIComponent(jobId)}`);
        const body = await response.json();
        if (body.ready) return body;
        await page.waitForTimeout(100);
    }
    throw new Error('submission polling timed out');
}

test('normal practice mode remains outside the gate flow', async ({ page }) => {
    await page.goto('/problems/two-sum');
    await expect(page.getByLabel('Language')).toContainText('Java');
    await expect(page.getByRole('button', { name: 'Give Up' })).toHaveCount(0);
    await expect(page.getByText('Reference Solution')).toBeVisible();
});

test('gate toolbar keeps the problem while switching variants and Give Up releases without the judge', async ({ page }) => {
    await page.goto('/gate?language=python&scaffold=medium');
    await expect(page).toHaveURL(/codegate=1/);
    await expect(page.getByLabel('Language')).toHaveValue('python');
    await expect(page.getByLabel('Scaffold')).toHaveValue('medium');
    await expect(page.getByText('Reference Solution')).toHaveCount(0);

    await page.locator('.monaco-editor .view-lines').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText('# autosaved gate draft');
    const problemId = new URL(page.url()).pathname.split('/').pop()!;
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), `codegate:draft:${problemId}:python:medium`)).toContain('autosaved gate draft');

    const initialProblemId = new URL(page.url()).pathname.split('/').pop()!;
    const first = bindingFrom(page);

    await page.getByLabel('Language').selectOption('cpp');
    await expect.poll(() => bindingFrom(page).challengeId).not.toBe(first.challengeId);
    expect(new URL(page.url()).pathname.split('/').pop()).toBe(initialProblemId);
    await expect(page.getByLabel('Language')).toHaveValue('cpp');

    const languageSwitch = bindingFrom(page);
    await page.getByLabel('Scaffold').selectOption('hard');
    await expect.poll(() => bindingFrom(page).challengeId).not.toBe(languageSwitch.challengeId);
    expect(new URL(page.url()).pathname.split('/').pop()).toBe(initialProblemId);
    await expect(page.getByLabel('Scaffold')).toHaveValue('hard');

    const variantSwitch = bindingFrom(page);
    await page.getByRole('button', { name: 'Different Problem' }).click();
    await expect.poll(() => bindingFrom(page).challengeId).not.toBe(variantSwitch.challengeId);
    expect(new URL(page.url()).pathname.split('/').pop()).not.toBe(initialProblemId);

    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Give Up' }).click();
    await expect(page).toHaveURL(/\/gate\/released\?outcome=given-up/);
    await expect(page.getByText('Session released')).toBeVisible();
});

test('tooltips and editor settings stay inside narrow viewport bounds', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 720 });
    await page.goto('/problems/two-sum');

    const paneToggle = page.getByRole('button', { name: 'Hide problem pane' });
    await paneToggle.hover();
    const tooltip = page.locator('.tooltip-box');
    await expect(tooltip).toBeVisible();
    const tooltipBox = await tooltip.boundingBox();
    expect(tooltipBox).not.toBeNull();
    expect(tooltipBox!.x).toBeGreaterThanOrEqual(0);
    expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(420);

    await page.getByRole('button', { name: 'Editor Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Editor settings' });
    await expect(settings).toBeVisible();
    const settingsBox = await settings.boundingBox();
    expect(settingsBox).not.toBeNull();
    expect(settingsBox!.x).toBeGreaterThanOrEqual(0);
    expect(settingsBox!.x + settingsBox!.width).toBeLessThanOrEqual(420);
    expect(settingsBox!.y).toBeGreaterThanOrEqual(0);
    expect(settingsBox!.y + settingsBox!.height).toBeLessThanOrEqual(720);
});

test('stale challenges are rejected and full-suite acceptance releases exactly once', async ({ page }) => {
    await page.goto('/gate?language=python&scaffold=medium');
    const stale = bindingFrom(page);
    const staleProblemId = new URL(page.url()).pathname.split('/').pop()!;
    const refresh = await page.request.post('/api/codegate/session', { data: { action: 'refresh', ...stale, language: 'python' } });
    expect(refresh.ok()).toBeTruthy();
    const refreshed = await refresh.json();

    const staleSubmit = await page.request.post('/api/submit', {
        data: { problemId: staleProblemId, language: 'python', code: '# stale challenge', startTcNo: 0, gate: stale }
    });
    expect(staleSubmit.status()).toBe(409);

    const gate = { sessionId: refreshed.id, challengeId: refreshed.challenge.id, scaffold: refreshed.challenge.variant.scaffold };
    const activeProblemId = refreshed.challenge.variant.problemId;
    const correctPython = reference(activeProblemId);
    let startTcNo = 0;
    let submissionId: string | undefined;
    let finalBody: any;
    for (let chunk = 0; chunk < 4; chunk++) {
        const started = await page.request.post('/api/submit', {
            data: { problemId: activeProblemId, language: 'python', code: correctPython, startTcNo, gate: { ...gate, submissionId } }
        });
        const startBody = await started.json();
        expect(started.ok(), JSON.stringify(startBody)).toBeTruthy();
        submissionId = startBody.submissionId;
        finalBody = await poll(page, startBody.jobId);
        if (finalBody.allAccepted) break;
        expect(finalBody.accepted).toBeTruthy();
        startTcNo = finalBody.passedTc;
    }
    expect(finalBody.allAccepted).toBeTruthy();
    expect(finalBody.released).toBeTruthy();

    const duplicateRelease = await page.request.post('/api/codegate/session', { data: { action: 'give-up', ...gate } });
    expect(duplicateRelease.status()).toBe(409);
});
