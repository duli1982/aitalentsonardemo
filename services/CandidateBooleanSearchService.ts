import type { Candidate } from '../types';
import { effectiveConsent } from './CandidateRecordService';

type Token = { kind: 'term' | 'and' | 'or' | 'not' | 'lparen' | 'rparen'; value: string };
type Node = { kind: 'term'; value: string } | { kind: 'and' | 'or'; left: Node; right: Node } | { kind: 'not'; value: Node };

const tokenize = (query: string): Token[] => {
  const tokens: Token[] = [];
  const pattern = /\s*(\(|\)|AND\b|OR\b|NOT\b|(?:[a-zA-Z_][\w-]*:)?"[^"]+"|[^\s()]+)\s*/gi;
  for (const match of query.matchAll(pattern)) {
    const value = match[1];
    const upper = value.toUpperCase();
    tokens.push(upper === 'AND' ? { kind: 'and', value } : upper === 'OR' ? { kind: 'or', value } : upper === 'NOT' ? { kind: 'not', value } : value === '(' ? { kind: 'lparen', value } : value === ')' ? { kind: 'rparen', value } : { kind: 'term', value });
  }
  return tokens;
};

function withImplicitAnd(tokens: Token[]) {
  const result: Token[] = [];
  tokens.forEach((token) => {
    const previous = result.at(-1);
    if (previous && ['term', 'rparen'].includes(previous.kind) && ['term', 'lparen', 'not'].includes(token.kind)) result.push({ kind: 'and', value: 'AND' });
    result.push(token);
  });
  return result;
}

function parse(query: string): Node | null {
  const tokens = withImplicitAnd(tokenize(query));
  let index = 0;
  const primary = (): Node => {
    const token = tokens[index++];
    if (!token) throw new Error('Search expression ended unexpectedly.');
    if (token.kind === 'not') return { kind: 'not', value: primary() };
    if (token.kind === 'lparen') { const node = expression(); if (tokens[index++]?.kind !== 'rparen') throw new Error('Missing closing parenthesis.'); return node; }
    if (token.kind !== 'term') throw new Error(`Unexpected operator ${token.value}.`);
    return { kind: 'term', value: token.value };
  };
  const conjunction = (): Node => { let node = primary(); while (tokens[index]?.kind === 'and') { index++; node = { kind: 'and', left: node, right: primary() }; } return node; };
  const expression = (): Node => { let node = conjunction(); while (tokens[index]?.kind === 'or') { index++; node = { kind: 'or', left: node, right: conjunction() }; } return node; };
  if (!tokens.length) return null;
  const node = expression();
  if (index !== tokens.length) throw new Error(`Unexpected token ${tokens[index].value}.`);
  return node;
}

function searchable(candidate: Candidate, field?: string): string {
  const values: Record<string, string[]> = {
    name: [candidate.name], email: [candidate.email ?? ''], phone: [candidate.phone ?? ''],
    skill: candidate.skills ?? [], language: (candidate.languages ?? []).flatMap((item) => [item.language, `${item.language} ${item.level}`]),
    location: [candidate.location ?? ''], role: [candidate.currentRole ?? candidate.role ?? candidate.title ?? ''], type: [candidate.type ?? ''],
    client: (candidate.clientSubmissions ?? []).flatMap((item) => [item.clientName, item.jobTitle]),
    submission: (candidate.clientSubmissions ?? []).map((item) => item.status), consent: [effectiveConsent(candidate.consent).status],
    status: [candidate.employmentStatus ?? '', ...Object.values(candidate.pipelineStage ?? {})],
  };
  return (field && values[field] ? values[field] : Object.values(values).flat()).join(' ').toLowerCase();
}

function matchesTerm(candidate: Candidate, raw: string) {
  const separator = raw.indexOf(':');
  const field = separator > 0 ? raw.slice(0, separator).toLowerCase() : undefined;
  const value = (separator > 0 ? raw.slice(separator + 1) : raw).replace(/^"|"$/g, '').toLowerCase();
  return searchable(candidate, field).includes(value);
}

function evaluate(candidate: Candidate, node: Node): boolean {
  if (node.kind === 'term') return matchesTerm(candidate, node.value);
  if (node.kind === 'not') return !evaluate(candidate, node.value);
  return node.kind === 'and' ? evaluate(candidate, node.left) && evaluate(candidate, node.right) : evaluate(candidate, node.left) || evaluate(candidate, node.right);
}

export function searchCandidates(query: string, candidates: Candidate[]): { candidates: Candidate[]; error: string | null } {
  try { const ast = parse(query.trim()); return { candidates: ast ? candidates.filter((candidate) => evaluate(candidate, ast)) : candidates, error: null }; }
  catch (error) { return { candidates: [], error: error instanceof Error ? error.message : 'Invalid Boolean expression.' }; }
}
