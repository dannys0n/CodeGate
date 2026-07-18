import type { ProgramRunner } from '$lib/runners/ProgramRunner';
import { JavaRunner } from '$lib/runners/JavaRunner';
import { PythonRunner } from '$lib/runners/PythonRunner';
import { CppRunner } from '$lib/runners/CppRunner';
import { CSharpRunner } from '$lib/runners/CSharpRunner';
import { RustRunner } from '$lib/runners/RustRunner';
import { GoRunner } from '$lib/runners/GoRunner';
import { TypeScriptRunner } from '$lib/runners/TypeScriptRunner';
import type { GateLanguage } from '$lib/codegate/types';

export function createProgramRunner(language: GateLanguage, problemId: string, testCases: any[], code: string): ProgramRunner {
    if (language === 'java') return new JavaRunner(problemId, testCases, code);
    if (language === 'python') return new PythonRunner(problemId, testCases, code);
    if (language === 'cpp') return new CppRunner(problemId, testCases, code);
    if (language === 'csharp') return new CSharpRunner(problemId, testCases, code);
    if (language === 'rust') return new RustRunner(problemId, testCases, code);
    if (language === 'go') return new GoRunner(problemId, testCases, code);
    if (language === 'typescript') return new TypeScriptRunner(problemId, testCases, code);
    throw new Error(`${language} is not supported`);
}
