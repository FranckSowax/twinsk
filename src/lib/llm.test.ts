import { afterEach, describe, expect, it } from 'vitest';
import { llmConfigured, llmCostFcfa, llmKeyVar, llmModel, llmProvider } from './llm';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe('couche IA : fournisseur, modèle, coût', () => {
  it('OpenRouter + GLM 5.3 Flash par défaut (choix du 29 sept. 2026)', () => {
    delete process.env.ANALYSIS_LLM_PROVIDER;
    delete process.env.ANALYSIS_MODEL;
    expect(llmProvider()).toBe('openrouter');
    expect(llmModel()).toBe('z-ai/glm-5.3-flash');
    expect(llmKeyVar()).toBe('OPENROUTER_API_KEY');
  });
  it('clé requise ; autre fournisseur ou modèle par variable', () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(llmConfigured('openrouter')).toBe(false);
    process.env.OPENROUTER_API_KEY = 'x';
    expect(llmConfigured('openrouter')).toBe(true);
    process.env.ANALYSIS_LLM_PROVIDER = 'kimi';
    process.env.ANALYSIS_MODEL = 'moonshot-v1-8k';
    expect([llmProvider(), llmModel()]).toEqual(['kimi', 'moonshot-v1-8k']);
  });
  it('coût réel du fournisseur en priorité, sinon estimation sur les tokens', () => {
    delete process.env.USD_TO_FCFA;
    expect(llmCostFcfa({ provider: 'openrouter', inputTokens: 2000, outputTokens: 400, costUsd: 0.0005 })).toBe(0.3);
    expect(llmCostFcfa({ provider: 'openrouter', inputTokens: 2000, outputTokens: 400 })).toBe(0.3);
  });
});
