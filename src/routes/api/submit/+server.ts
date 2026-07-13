import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs/promises';
import path from 'path';
import vm from 'vm';
import { getMarkerResponses } from '../../../lib/markerRunner';
import type { ProgramRunner } from '$lib/runners/ProgramRunner';
import { JavaRunner } from '$lib/runners/JavaRunner';
import { PythonRunner } from '$lib/runners/PythonRunner';
import { CppRunner } from '$lib/runners/CppRunner';
import { CSharpRunner } from '$lib/runners/CSharpRunner';
import { RustRunner } from '$lib/runners/RustRunner';
import { GoRunner } from '$lib/runners/GoRunner';
import { TypeScriptRunner } from '$lib/runners/TypeScriptRunner';
import { TIMEOUT_MESSAGE, type JobStatus } from '$lib/utils/util';
import { abandonGateSubmission, advanceGateSubmission, beginGateSubmissionChunk, requireActiveChallenge } from '$lib/server/codegate/sessions';

type GateBinding = {
    sessionId: string;
    challengeId: string;
    scaffold: string;
    submissionId: string;
};

type SubmitResult = {
    accepted?: boolean;
    allAccepted?: boolean;
    totalTc?: number;
    passedTc?: number;
    results?: any[];
    stale?: boolean;
    released?: boolean;
};
type SubmitJob = {
    id: string;
    status: JobStatus;
    createdAt: number;
    result?: SubmitResult;
    timeout?: boolean;
    timeoutTestCase?: any;
    error?: string;
    errorTestCase?: any;
    gate?: GateBinding;
};

const jobs: Map<string, SubmitJob> = new Map();

function genId() {
    const g: any = globalThis as any;
    if (g.crypto && typeof g.crypto.randomUUID === 'function') return g.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isJavaLanguage(language: string): boolean {
    return language === 'java';
}

async function executeSubmit(problemId: string, language: string, code: string, startTcNo: number, job: SubmitJob) {
    let timeoutTestcase: any = null;
    try {
        job.status = 'running';

        const problemPath = path.resolve('problems', problemId, 'metadata.json');
        const problemContent = await fs.readFile(problemPath, 'utf-8');
        const problemData = JSON.parse(problemContent);

        let officialTestsPath = path.resolve('problems', problemId, 'official-tests.json');
        let testCases: any[] = [];
        let totalTc = 0;
        let passedTc = 0;
        try {
            const officialContent = await fs.readFile(officialTestsPath, 'utf-8');
            testCases = JSON.parse(officialContent);
            totalTc = testCases.length;
            if (startTcNo >= totalTc) {
                if (job.gate) {
                    const gateResult = advanceGateSubmission(job.gate.sessionId, job.gate.challengeId, job.gate.submissionId, startTcNo, 0, totalTc, true);
                    job.result = gateResult.stale
                        ? { accepted: false, allAccepted: false, totalTc, passedTc: startTcNo, results: [], stale: true }
                        : { allAccepted: gateResult.released, accepted: gateResult.released, totalTc, passedTc: totalTc, results: [], released: gateResult.released };
                } else {
                    job.result = { allAccepted: true, totalTc, passedTc: totalTc, results: [] };
                }
                job.status = 'completed';
                return;
            }
            let tcNo = startTcNo;
            const newTestCases = [testCases[tcNo]];
            timeoutTestcase = newTestCases[0];
            while (!testCases[tcNo]._isLargeTest && tcNo + 1 < testCases.length && !testCases[tcNo + 1]._isLargeTest) {
                newTestCases.push(testCases[tcNo + 1]);
                tcNo++;
            }
            testCases = newTestCases;
            passedTc = newTestCases.length;
            const JAVASCRIPT_PREFIX = '@javascript:';
            for (let i = 0; i < testCases.length; i++) {
                const tc = testCases[i];
                if (tc && typeof tc === 'object') {
                    for (const k of Object.keys(tc)) {
                        const v = tc[k];
                        if (typeof v === 'string' && v.startsWith(JAVASCRIPT_PREFIX)) {
                            const expr = v.slice(JAVASCRIPT_PREFIX.length);
                            try {
                                const evaluated = vm.runInNewContext(expr, {}, { timeout: 2000 });
                                if (typeof evaluated === 'string') {
                                    tc[k] = evaluated;
                                } else if (typeof evaluated === 'object') {
                                    tc[k] = JSON.stringify(evaluated);
                                } else {
                                    tc[k] = String(evaluated);
                                }
                            } catch (e) {
                                try { tc[k] = v.replace(JAVASCRIPT_PREFIX, ''); } catch {}
                            }
                        }
                    }
                }
            }
        } catch (err) {
            testCases = problemData.testCases || [];
            totalTc = testCases.length;
            passedTc = testCases.length;
            if (startTcNo >= totalTc) {
                job.result = { allAccepted: true, totalTc, passedTc: 0, results: [] };
                job.status = 'completed';
                return;
            }
        }

        let programRunner: ProgramRunner | null = null;
        if (language === 'java') {
            programRunner = new JavaRunner(problemId, testCases, code);
        } else if (language === 'python') {
            programRunner = new PythonRunner(problemId, testCases, code);
        } else if (language === 'cpp') {
            programRunner = new CppRunner(problemId, testCases, code);
        } else if (language === 'csharp') {
            programRunner = new CSharpRunner(problemId, testCases, code);
        } else if (language === 'rust') {
            programRunner = new RustRunner(problemId, testCases, code);
        } else if (language === 'go') {
            programRunner = new GoRunner(problemId, testCases, code);
        } else if (language === 'typescript') {
            programRunner = new TypeScriptRunner(problemId, testCases, code);
        }
        if (!programRunner) {
            throw new Error(`${language} is not supported yet`);
        }
        await programRunner.compile();
        const rawResults = await programRunner.run();

        const hasMergedMarker = isJavaLanguage(language) &&
            rawResults.length > 0 &&
            rawResults[0].includes(':::VERDICT:::');

        let markerResponses: any[];
        const parsed: any[] = [];
        if (hasMergedMarker) {
            markerResponses = rawResults.map((chunk) => {
                const lines = (chunk || '').split('\n');
                const errorLine = lines.find((l) => l.startsWith(':::ERROR:::'));
                if (errorLine) {
                    const errMsg = errorLine.slice(':::ERROR:::'.length).trim();
                    parsed.push({ output: errMsg, error: true });
                    return {
                        actualAnswer: errMsg,
                        isCorrect: false,
                        correctAnswer: '',
                        logs: errMsg
                    };
                }
                const resultLine = lines.find((l) => l.startsWith(':::RESULT:::'));
                const verdictLine = lines.find((l) => l.startsWith(':::VERDICT:::'));
                const answerLine = lines.find((l) => l.startsWith(':::ANSWER:::'));
                parsed.push({ output: resultLine?.slice(':::RESULT:::'.length).trim() ?? '', error: false });
                return {
                    actualAnswer: resultLine ? resultLine.slice(':::RESULT:::'.length).trim() : '',
                    isCorrect: verdictLine ? verdictLine.slice(':::VERDICT:::'.length).trim() === 'true' : false,
                    correctAnswer: answerLine ? answerLine.slice(':::ANSWER:::'.length).trim() : '',
                    logs: lines
                        .filter((l) =>
                            !l.startsWith(':::RESULT:::') &&
                            !l.startsWith(':::VERDICT:::') &&
                            !l.startsWith(':::ANSWER:::') &&
                            !l.startsWith(':::ERROR:::')
                        )
                        .filter((l) => l.trim().length > 0)
                        .join('\n')
                };
            });
        } else {
            const parsedResults = rawResults.map((chunk) => {
                try {
                    const lines = (chunk || '').split('\n');
                    const errorLine = lines.find((l) => l.startsWith(':::ERROR:::'));
                    if (errorLine) {
                        const errMsg = errorLine.slice(':::ERROR:::'.length).trim();
                        return { output: errMsg, logs: errMsg, error: true };
                    }
                    const idx = lines.findIndex((l) => l.startsWith(':::RESULT:::'));
                    if (idx === -1) {
                        return { output: (chunk || '').trim(), logs: '' };
                    }
                    const output = lines[idx].slice(':::RESULT:::'.length).trim();
                    const logs = lines
                        .filter((_, i) => i !== idx)
                        .filter((l) => l.trim().length > 0)
                        .join('\n');
                    return { output, logs };
                } catch {
                    return { output: (chunk || '').trim(), logs: '' };
                }
            });
            parsed.push(...parsedResults);
            const onlyOutputs = parsed.map((p) => p.output);
            const markerOutputs = onlyOutputs.map((o, i) => {
                if (parsed[i]?.error) {
                    const tc = testCases[i];
                    return tc.adjList || tc.input || '[]';
                }
                return o;
            });
            try {
                markerResponses = await getMarkerResponses(
                    problemId,
                    problemData.functionName,
                    problemData.params,
                    testCases,
                    markerOutputs,
                    problemData.outputType
                );
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : String(e);
                markerResponses = testCases.map((_, i) => ({
                    actualAnswer: parsed[i]?.output ?? '',
                    correctAnswer: parsed[i]?.output ?? '',
                    isCorrect: false,
                    logs: message
                }));
            }
            markerResponses = markerResponses.map((mr, i) => ({
                ...mr,
                isCorrect: parsed[i]?.error ? false : mr.isCorrect,
                logs: parsed[i]?.logs ?? ''
            }));
        }

        const finalResponse = testCases.map((tc, index) => ({
            ...tc,
            output: parsed[index]?.error ? parsed[index].output : ((markerResponses[index] as any)?.actualAnswer ?? markerResponses[index]?.output ?? 'No output'),
            logs: markerResponses[index]?.logs ?? '',
            isCorrect: markerResponses[index].isCorrect,
            correctAnswer: markerResponses[index].correctAnswer,
            error: null
        }));
        const accepted = markerResponses.every((m: any) => m.isCorrect);
        const updatedPassedTc = (job.result?.passedTc ? job.result?.passedTc : 0) + testCases.length;
        if (job.gate) {
            const gateResult = advanceGateSubmission(job.gate.sessionId, job.gate.challengeId, job.gate.submissionId, startTcNo, testCases.length, totalTc, accepted);
            job.result = gateResult.stale
                ? { accepted: false, totalTc, passedTc: startTcNo, results: finalResponse, stale: true }
                : { accepted, allAccepted: gateResult.released, totalTc, passedTc: updatedPassedTc, results: finalResponse, released: gateResult.released };
        } else {
            job.result = { accepted, totalTc, passedTc: updatedPassedTc, results: finalResponse };
        }
        job.status = 'completed';
    } catch (error: any) {
        if (job.gate) abandonGateSubmission(job.gate.sessionId, job.gate.challengeId, job.gate.submissionId);
        if (error && error.toString() && error.toString().indexOf(TIMEOUT_MESSAGE) !== -1) {
            job.timeout = true;
            job.timeoutTestCase = timeoutTestcase;
            job.status = 'completed';
        } else {
            job.error = `Submission failed: details: ${error.message || error}`;
            job.errorTestCase = timeoutTestcase;
            job.status = 'error';
        }
    }
}

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { problemId, language, code, startTcNo, gate } = await request.json();
        const normalizedStart = Number(startTcNo) || 0;
        let gateBinding: GateBinding | undefined;
        if (gate) {
            const sessionId = String(gate.sessionId ?? '');
            const challengeId = String(gate.challengeId ?? '');
            const scaffold = String(gate.scaffold ?? '');
            const session = requireActiveChallenge(sessionId, challengeId);
            const selected = session.challenge.variant;
            if (selected.problemId !== problemId || selected.language !== language || selected.scaffold !== scaffold) {
                throw new Error('Submission does not match the active gate challenge');
            }
            const started = beginGateSubmissionChunk(sessionId, challengeId, normalizedStart, gate.submissionId ? String(gate.submissionId) : undefined);
            gateBinding = { sessionId, challengeId, scaffold, submissionId: started.submissionId };
        }
        const id = genId();
        const job: SubmitJob = { id, status: 'pending', createdAt: Date.now(), gate: gateBinding };
        jobs.set(id, job);
        executeSubmit(problemId, language, code, normalizedStart, job);
        return json({ jobId: id, submissionId: gateBinding?.submissionId });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, { status: 409 });
    }
};

export const GET: RequestHandler = async ({ url }) => {
    const jobId = url.searchParams.get('jobId') || '';
    const job = jobs.get(jobId);
    if (!job) return json({ error: 'Job not found' }, { status: 404 });
    if (job.status === 'pending' || job.status === 'running') {
        return json({ ready: false, status: job.status, passedTc: job.result?.passedTc });
    }
    if (job.timeout) {
        return json({ ready: true, timeout: true, timeoutTestCase: job.timeoutTestCase });
    }
    if (job.status === 'error') {
        return json({ ready: true, error: job.error || 'Submission failed', errorTestCase: job.errorTestCase }, { status: 400 });
    }
    return json({ ready: true, ...(job.result || {}) });
};
